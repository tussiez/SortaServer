// same as @tussiez/NishBankKit
const SortaAccounts = {
  login: () => {
    // create window
    if(!document) throw new Error("requires document to create login ele");
    return new Promise((resolve, reject) => {
    let wrap = document.createElement("div");
    wrap.setAttribute('style','height: 40%; width: 30%;max-width: 15rem;max-height:15rem;min-width: 12rem;min-height: 10rem; color: white; font-family: georgia, arial, sans-serif, serif;z-index: 9999;position: absolute; left: 35%; top: 30%; background-color: #333;border-radius: 3px;padding: 4px;z-index:9999');
    let header = document.createElement('span');
    header.setAttribute('style','font-weight: bold');
    header.innerHTML = 'SortaAccounts';

    wrap.appendChild(header);

    let hr = document.createElement('hr');
    wrap.appendChild(hr);

    let usernameInput = document.createElement('input');
    usernameInput.setAttribute('type', 'text');
    usernameInput.setAttribute('placeholder', 'Username');
    usernameInput.setAttribute('title','Account username');
    
    wrap.appendChild(usernameInput);
    
    let br = document.createElement('br');
    wrap.appendChild(br);

    let passwordInput = document.createElement('input');
    passwordInput.setAttribute('type', 'password');
    passwordInput.setAttribute('title','Account password');
    passwordInput.setAttribute('placeholder','Password');

    wrap.appendChild(passwordInput);

    wrap.appendChild(br);

    let submitButton = document.createElement('button');
    submitButton.innerHTML = 'Verify';

    wrap.appendChild(submitButton);

    wrap.appendChild(br);

    let infoDisp = document.createElement('span');
    infoDisp.innerHTML = 'Type in your username and password.';
    wrap.appendChild(infoDisp);

    submitButton.onclick = () => {
     let usernameVal = usernameInput.value;
     let passwordVal = passwordInput.value;
     if(usernameVal != '' && passwordVal != '') {
      infoDisp.style.color = 'white';
      infoDisp.innerHTML = 'Contacting server..';
      let ur = 'https://sortaaccounts.sortagames.repl.co/login?username='+btoa(usernameVal)+'&password='+btoa(passwordVal);
      fetch(ur).then(res => {
        if(res.status === 200) {
          // 200 - OK
          res.json().then(txt => {
            // Done!
            document.body.removeChild(wrap);
            resolve(true);
          }).catch(err => {
            
          })
        } else {
          infoDisp.style.color = 'yellow';
          infoDisp.innerHTML = 'Failed to contact server, closing now.';
          submitButton.disabled = true;
          setTimeout(() => {
            document.body.removeChild(wrap);
            resolve(false);
          },3000);
          if(res.status === 403) {
            document.body.removeChild(wrap);
            resolve(false);
          }
        }
      })

     } else {
       infoDisp.style.color = 'yellow';
       infoDisp.innerHTML = 'Type in your username and password before submitting.'
     }
    }


    document.body.appendChild(wrap);
    });
  }
}
export default SortaAccounts;