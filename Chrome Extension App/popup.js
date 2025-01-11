let responseElement;
let list = document.getElementById('emailList');
var dict = {};

document.addEventListener('DOMContentLoaded', function() {
    const btnAction = document.getElementById('btnAction');
    const btnAction2 = document.getElementById('btnAction2');
    btnAction.addEventListener('click', async function() {
        const pageContent = parsePageContent();
        const response = await openAiCall(pageContent);
        const content = response['message'][1]?.content;
        console.log('Page Content: ', content);
        list.append(content)
    });

    btnAction2.addEventListener('click', async function () {
        let tabUrl = ''
        await chrome.tabs.query({ 'active': true, 'windowId': chrome.windows.WINDOW_ID_CURRENT },
            async function (tabs) {
                tabUrl = tabs[0].url;
                const response = await openAiCall2(tabUrl);
            }
        );
        
    });
});

// Function to scrape emails
function parsePageContent() {
    return new Promise((resolve) => {
        // Get the current tab
        chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
            // Get the current tab's URL and ID
            var tabId = tabs[0].id;

            chrome.scripting.executeScript(
                {
                    target: { tabId: tabId },
                    function: () => {
                        const paragraphs = document.querySelectorAll("p");
                        let textContent = "";

                        paragraphs.forEach((paragraph) => {
                            textContent += " " + paragraph.innerText;
                        });

                        return textContent;
                    },
                },
                (results) => {
                    if (chrome.runtime.lastError) {
                        console.error(JSON.stringify(chrome.runtime.lastError));
                        return;
                    }

                    const pageContent = results[0].result;
                    console.log("Page content:", pageContent);

                    resolve(pageContent);
                }
            );
        });
    });
}

async function openAiCall(awaitText) {
    const text = await awaitText;
    console.log("Summarizing text:", text);
    // Send an HTTP request to the specified URL
    try {
        const response = await fetch("http://localhost:3000/chatGPT", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer YOUR_API_KEY_HERE`
            },
            body: JSON.stringify({
                "context": "Is this email spam or phishing?",
                "message": text
            }),
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(error);
    }
}

async function openAiCall2(url) {
    const details = url.replace("https://github.com/", "");
    const githubData = details.split("/");
    const githubUrl = "https://api.github.com/repos/" + githubData[0] + "/" + githubData[1] + "/contents";
    const githubFiles = await getGithubRepoFiles(githubUrl);
    const directories = [];
    const files = [];
    githubFiles.forEach((element) => {
        if (element['type'] == 'dir')
        {
            directories.push(element);
        } else {
            files.push(element);
        }
    });
    while(directories.length != 0) {
        currentElement = directories.pop();
        const dir_files = await getGithubRepoFiles(currentElement['url']);
        dir_files.forEach((element) => {
            if (element['type'] == 'dir') {
                directories.push(element);
            } else {
                files.push(element);
            }
        });
    }

    const result = [];
    files.forEach(async (file) => {
        if (endsWithAny(file['name'], ['.py', '.js', '.cs', '.java', '.json', '.html'])) {
            const temp = await analyzeFile(file);
            console.log(file['name']);
            const temp2 = await streamToString(temp['body']);
            const result2 = await chatGPTFileVulnerable(temp2);
            if(result2['message'] !== undefined) {
                dict[(file['name'])] = await result2['message'][1]?.content;
                console.log(Object.keys(dict).length);
                const myTable = document.querySelector('table#repoList')
                for(var i = 1;i<myTable.rows.length;){
                    myTable.deleteRow(i);
                }
                if(dict !== undefined){
                    console.log(Object.keys(dict).length)
                    for (const [key, value] of Object.entries(dict)) {
                        let row = myTable.insertRow()
                        row.insertCell().textContent = key;
                        row.insertCell().textContent = value;
                    };
                }
            }
        }
    });

    return result;
}

function endsWithAny(str, suffixes) {
    for (const suffix of suffixes) {
        if (str.endsWith(suffix)) {
            return true;
        }
    }
    return false;
}


async function chatGPTFileVulnerable(file) {
    const text = await file;
    const system_prompt = "You are a skilled application security engineer doing a static code analysis on a code repository. You will be sent code , which you should assess for potential vulnerabilities." + 
        "Output vulnerabilities found in this format: Vulnerability: [Vulnerability Name].Line: [Line Number].Code: [Code snippet of the vulnerable line(s) of code] Explanation: [Explanation of the vulnerability]";
    
    const user_prompt = "The code is as follows: " + text;
        // Send an HTTP request to the specified URL
    try {
        const response = await fetch("http://localhost:3000/chatGPT", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer YOUR_API_KEY_HERE`
            },
            body: JSON.stringify({
                "context": system_prompt,
                "message": user_prompt
            }),
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(error);
    }
}

async function analyzeFile(file) {
    const file_url = file['download_url'];
    const fileContent = await getGithubRepoFilesContent(file_url);
    return fileContent;
}

async function streamToString(stream) {
    const reader = stream.getReader();
    const textDecoder = new TextDecoder();
    let result = '';

    async function read() {
        const { done, value } = await reader.read();

        if (done) {
            return result;
        }

        result += textDecoder.decode(value, { stream: true });
        return read();
    }

    return read();
}

async function getGithubRepoFiles(url) {
    githubToken = "YOUR_GITHUB_TOKEN_HERE";
    const apiUrl = url;
    try {
        const response = await fetch(apiUrl, {
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `token ${githubToken}`
            }
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(error);
    }
}

async function getGithubRepoFilesContent(url) {
    githubToken = "YOUR_GITHUB_TOKEN_HERE";
    const apiUrl = url;
    try {
        const response = await fetch(apiUrl, {
            method: "GET"
        });
        const data = await response;
        return data;
    } catch (error) {
        console.error(error);
    }
}