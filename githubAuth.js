class GitHubAuth {
  constructor() {
    this.clientId = 'Ov23lil5wqiBdGXiK4oM'; 
  }

  async authenticate(deviceData) {
    try {
      const token = await this.pollForToken(deviceData.device_code, deviceData.interval);      
      return token;
    } catch (error) {
      console.error('GitHub auth failed:', error);
      throw error;
    }
  }

  async getDeviceCode() {
    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        scope: 'gist' 
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to get device code');
    }
    
    return await response.json();
  }

  async pollForToken(deviceCode, interval = 5) {
    const maxAttempts = 60; 
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, interval * 1000));
      
      try {
        const response = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: this.clientId,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
          })
        });
        
        const data = await response.json();
        
        if (data.access_token) {
          return data.access_token;
        }
        
        if (data.error === 'authorization_pending') {
          attempts++;
          continue;
        }
        
        if (data.error === 'expired_token') {
          throw new Error('Device code expired');
        }
        
      } catch (error) {
        console.error('Polling error:', error);
        attempts++;
      }
    }
    
    throw new Error('Authentication timeout');
  }

async createGist(code,filename,token) {
  
    return fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json',
        'Authorization': `token ${token}`
        },
        body: JSON.stringify({
        "description": "A Gist created from a code selection",
        "public": true,
        "files": {
            [filename]: {
            "content": code
            }
        }
        })
    }).then(response => response.json())
      .then(data => data.html_url);
      
    }
  }