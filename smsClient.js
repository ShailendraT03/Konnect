const axios = require("axios");

async function verify(params){
    return new Promise(async function(resolve, reject) {
        axios.post('https://api.textlocal.in/send', params)
        .then((res) => {
        resolve(res.data)
        })
        .catch((error) => {
        resolve(error)
        })
    });
}

const smsclient = {}
smsclient.sendVmsg = async function(user){
    if (user && user.phone_num && user.verifycode && user.appcode) { 
      const params = new URLSearchParams();
      params.append("apiKey","gZG/Ixi3uyo-BQKdXs2O0mLNDfIRcHC1vjKeF0eqjM");
      params.append("sender","KCSLLP");
      params.append("numbers", [parseInt("91" + user.phone_num)]);
      params.append(
        "message",
        `Your Konnectogrow OTP is: ${user.verifycode}
 ${user.appcode}`
      );
      return await verify(params)
    }
  }

module.exports = smsclient;
