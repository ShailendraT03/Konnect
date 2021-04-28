const mysql = require('mysql');
const execSync = require('child_process').execSync;
const creds = require('./database_auth_mod')
const config = require('./config')
frmts=''
ctg=[]
image={}

sql = {
    host	: creds.sqlhost,
    user	: creds.sqluser,
	password: creds.sqlpass,
	port	: 3306,
    database: 'K2GServices'
}

formats=['jpg','jpeg','png']
formats.forEach((x)=>{frmts=frmts+"\\."+x+"$|"})
frmts=frmts.substring(0,frmts.length-1)

path=config.dirname+"/images_ui/"

cmd=`cd / ; tree -Rfi ${path} | grep -E *'(${frmts})';`
imgpaths = execSync(cmd)

imgpaths= String(imgpaths)
imgpaths=imgpaths.split('\n')
imgpaths.pop()
imgpaths.forEach((img)=>
    {
        ctgl=img.replace(`${path}`,'').split('/')
        ctg.push(ctgl[0])
    })

async function deleteImages(){
    return new Promise(function(resolve, reject) {
        connection = mysql.createConnection(sql);
        connection.query(`delete from KG_images`,(err,result) => {
            resolve(result)
        })
        connection.end()
    });
}    

async function insertImagectg(img){
    return new Promise(function(resolve, reject) {
        connection = mysql.createConnection(sql);
        var query=`insert into KG_images (imgpath,imgcategory) values ("${img.path}","${img.ctg}")`
        connection.query(query,(err,result) => {
            if(err){
                console.error(err);
                var rsv={}
                rsv.er=err.sqlMessage
                resolve(rsv);
            }
            resolve(result)
        })
        connection.end()
    });
}

async function main()
{
    dlimgs = await deleteImages()
    for(i=0;i<imgpaths.length;i++)
    {
        image.path=imgpaths[i]
        image.ctg=ctg[i]
        console.log(image)
        insimage = await insertImagectg(image)

        if(insimage.er !== undefined){
            console.log(i,`${insimage.er}`)
        }
    }
}

main()