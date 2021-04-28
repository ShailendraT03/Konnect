var crypto = require('crypto');

let encrypted={}

encrypted.saltHashPassword= (userpassword) =>{
    var salt = crypto.randomBytes(10).toString('hex').slice(0,10);
    var hash = crypto.pbkdf2Sync(userpassword, salt, 1000, 64, `sha512`).toString('hex')
    return{
        salt:salt,
        passwordHash:hash
        }
}

encrypted.validPassword = function(pass,userpassword,salt) { 
    var hash = crypto.pbkdf2Sync(pass,salt, 1000, 64, `sha512`).toString(`hex`); 
    return userpassword === hash; 
} 

module.exports = encrypted;


