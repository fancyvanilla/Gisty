const githubAuth = new GitHubAuth();
const code_container = document.getElementById('selectedText');
const githubAuthStatusContainer=document.getElementById('githtubAuthStatus')
const createGistButton = document.getElementById('createGistButton');
const recentGistsContainer = document.getElementById('recentGistsContainer');
const loadingSpinner = document.getElementById('loading-spinner');
chrome.storage.sync.get(['github_token'], (result) => {
  loadingSpinner.style.display = 'none';
  const token = result.github_token;
  if (token) {
    githubAuthStatusContainer.textContent = "🚀 You are authenticated with GitHub.";
    createGistButton.textContent = "Create Gist";
    code_container.style.display ='block';

    //show selected text
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length == 0) return;
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: () => window.getSelection().toString()
      }, (injectedResults) => {
        if (chrome.runtime.lastError) {
          code_container.textContent = "⚠️ Sorry, we couldn't access the selected text on this page."+
          " Try selecting code on a different website or tab..\n" 
          return;
        }
        let code = injectedResults[0].result.trim();
        if (code.length == 0) {
          code_container.textContent = "Nothing is selected";
        } else {
          code_container.textContent=code;
          code_container.style.whiteSpace = 'pre-wrap'; 
        }
      });
  });
  
    // show history
    chrome.storage.local.get(['recentGistUrl'], (result) => {
    const gist = result.recentGistUrl;
    if (gist) {
        recentGistsContainer.style.display = 'block';
        const link = document.createElement('a');
        link.href = gist.url;
        link.target = '_blank';
        link.className = 'recent-gist-link';
        let differnceInMinutes = Math.floor((new Date() - new Date(gist.time)) / 60000);
        if (differnceInMinutes < 1) {
            link.textContent = `🔗 ${gist.filename} (just now)`;
        } else if (differnceInMinutes < 60) {
            link.textContent = `🔗 ${gist.filename} (${differnceInMinutes} minute${differnceInMinutes > 1 ? 's' : ''} ago)`;
        }
        else if (differnceInMinutes < 1440) {
            link.textContent = `🔗 ${gist.filename} (${Math.floor(differnceInMinutes / 60)} hour${Math.floor(differnceInMinutes / 60) > 1 ? 's' : ''} ago)`;
        } else {
            // For more than a day, show the time
            link.textContent = `🔗 ${gist.filename} (${new Date(gist.time).toLocaleTimeString()})`;
        }
        recentGistsContainer.appendChild(link);
        recentGistsContainer.appendChild(document.createElement('br'));
    } else {
      recentGistsContainer.textContent = "No recent Gists found.";
    }
  });
  } else {
      githubAuthStatusContainer.textContent = "⚠️ You are not authenticated with GitHub."
      createGistButton.textContent = "Authenticate with GitHub";
      code_container.style.display = 'none';
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
              code_container.textContent = `⏳ Creating your Gist for ${lang}`;
              const filename = await generateFileName(lang);
              githubAuth.createGist(code, filename,token).then(gistUrl => {
                navigator.clipboard.writeText(gistUrl).then(() => {
                  code_container.textContent = `✅ Gist created successfully!`;
                  const url=document.createElement('a');
                  const span=document.createElement('span');
                  url.href = gistUrl;
                  url.target = '_blank';
                  url.textContent = `🔗${filename}`
                  span.textContent = " (Copied to clipboard!)";
                  code_container.appendChild(url);
                  code_container.appendChild(span);
                }).catch(err => {
                  console.error('Failed to copy:', err);
                  return;
                });
                let currentTime = new Date().toLocaleString();
                let recentGist={ url: gistUrl, filename:filename, time: currentTime, lang: lang};
                chrome.storage.local.set({"recentGistUrl":recentGist})
              }).catch(error => {
                if (error.status==403 && error.message.includes("rate limit")){
                      code_container.textContent = "⏰ GitHub rate limit reached. Try again in an hour.";
                  } else{
                      code_container.textContent = "❌ Failed to create Gist. Please try again.";
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

