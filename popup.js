const githubAuth = new GitHubAuth();
const code_container = document.getElementById('selectedText');
const githubAuthStatusContainer=document.getElementById('githtubAuthStatus')
const createGistButton = document.getElementById('createGistButton');

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length == 0) return;
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: () => window.getSelection().toString()
      }, (injectedResults) => {
        if (chrome.runtime.lastError) {
          code_container.textContent = "⚠️ This page can't be accessed. " +
          "Extensions don't work on special pages like chrome://settings." +"\n👉 Try again on a regular website like google.com";
          return;
        }
        let code = injectedResults[0].result.trim();
        if (code.length == 0) {
          code_container.innerHTML = "Nothing is selected";
        } else {
          code_container.innerHTML = code.length > 200 ? code.substring(0, 200) + "..." : code;
        }
      });
  });

chrome.storage.sync.get(['github_token'], (result) => {
  const token = result.github_token;
  if (token) {
    githubAuthStatusContainer.innerHTML = "You are authenticated with GitHub.";
    createGistButton.innerHTML = "Create Gist";
  } else {
      githubAuthStatusContainer.innerHTML = "You are not authenticated with GitHub. Click the button below to authenticate."
      createGistButton.innerHTML = "Authenticate with GitHub";
    }
  })

createGistButton.addEventListener('click', () => {
  //check if the user is authenticated
  chrome.storage.sync.get(['github_token'],(token) => {
    token = token.github_token;
    if (!token){
      //if not authenticated, authenticate the user
      githubAuth.getDeviceCode().then(deviceData => {
         chrome.runtime.sendMessage({ type: 'AUTHENTICATE_GITHUB', code:deviceData })
         chrome.tabs.create({
          url:`https://fancyvanilla.github.io/?code=${deviceData.user_code}&verification_uri=${encodeURIComponent(deviceData.verification_uri)}&expires_in=${deviceData.expires_in}`
         })
      })
    } 
    else{
      //if authenticated, proceed to create the gist
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          function: () => window.getSelection().toString()
        },async (injectedResults)=>{
            if (chrome.runtime.lastError) return;
            let code = injectedResults[0].result;
            code=code.trim();
            if (code.length == 0) return ;
            const result=hljs.highlightAuto(code); 
            const lang =result.language;
              code_container.innerHTML = `Creating Gist for language: ${lang}`;
              const filename = await generateFileName(lang);
              githubAuth.createGist(code, filename,token).then(gistUrl => {
                code_container.innerHTML = `Gist created: <a href="${gistUrl}" target="_blank">${gistUrl}</a>`;
                navigator.clipboard.writeText(gistUrl).then(() => {
                  console.log('Gist link copied to clipboard!');
                }).catch(err => {
                  console.error('Failed to copy:', err);
                  return;
                });
                
              }).catch(error => {
                if (error.status==403 && error.message.includes("rate limit")){
                      code_container.innerHTML = "⏰ GitHub rate limit reached. Try again in an hour.";
                  } else{
                      code_container.innerHTML = "❌ Failed to create Gist. Please try again.";
                  }
          })
        }  
        )
      });
    }
  })})
  
async function generateFileName(lang) {
  const [ nounsPromise, adjsPromise,languageToExtensionPromise ]=await Promise.all([fetch("./data/nouns.json"),fetch("./data/adjs.json"),fetch("./data/languageToExtension.json")]);
  const nouns=await nounsPromise.json();
  const adjs=await adjsPromise.json();
  const languageToExtension = await languageToExtensionPromise.json();
  const randomNoun=nouns.nouns[Math.floor(Math.random()*nouns.nouns.length)];
  const randomAdj=adjs.adjs[Math.floor(Math.random()*adjs.adjs.length)];
  const extension = languageToExtension[lang] || '.txt';
  return `${randomAdj}-${randomNoun}${extension}`;
}

