var crypto = require('crypto');

let encrypted={}

encrypted.genRandomString = function(length){
    return crypto.randomBytes(Math.ceil(length))
	    .toString('hex')
	    .slice(0,length);
};

encrypted.sha512 = function(password, salt){
    var hash = crypto.createHmac('sha512', password);
    return {
	salt:salt,
	passwordHash:encrypted.digestHmac(hash,salt)	//will be digested later
    };
};

encrypted.digestHmac = (hash,salt)=>{	//salted Hash
	hash.update(salt);
	return hash.digest('hex')
}


encrypted.saltHashPassword= (userpassword) =>{
    var salt = encrypted.genRandomString(8);
    return encrypted.sha512(userpassword, salt);
}

module.exports = encrypted;


