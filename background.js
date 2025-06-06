importScripts('GithubAuth.js')
const githubAuth = new GitHubAuth();
chrome.runtime.onMessage.addListener((message, _, sendMessage) => {
    if (message.type=='AUTHENTICATE_GITHUB') {
        deviceCode=message.code;
        githubAuth.authenticate(deviceCode)
        .then(token=>{
        chrome.storage.sync.set({ 'github_token': token })
        })
        .catch(error => {
            console.error("Authentication failed:", error);
        });
    }
} ) 
