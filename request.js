const axios = require('axios')
const config=require('./config')
user={}
srv=['Home Design and Construction','Architect model',
'Home Design and Construction','Interior Designer',
'Home Design and Construction','Modular Kitchen',
'Home Design and Construction','Painters for House/ office coloring',
'Home Design and Construction','CCTV Cameras installation',
'Home Moving and Shifting','Packers and movers',
'Home Moving and Shifting','Pest control',
'Home Moving and Shifting','Water Tank',
'Home Cleaning and Repair','Electricals and Electronic Repair',
'Home Cleaning and Repair','Plumbing',
'Home Cleaning and Repair','Carpentry',
'Tutors and Lessons','Home tutor',
'Party and Event Services','Wedding planner',
'Party and Event Services','Bridal Makeup',
'Party and Event Services','Pre and post wedding photography',
'Party and Event Services','Birthday Party organizer',
'Party and Event Services','Event organizer',
'Health and Wellness','Physiotherapy',
'Health and Wellness','Dietician',
'Health and Wellness','Yoga and Fitness Trainer at Home',
'Business','Web Designer and Developer',
'Business','CA for Taxation to Small Business']
srvlist=[]
sobj={}

async function reqregister(user){
    return new Promise(async function(resolve, reject) {
        axios.post(`http://${config.hostname}:5000/register`, user)
        .then((res) => {
        //console.log(res.data)
        resolve(1)
        })
        .catch((error) => {
        //console.error(error)
        resolve(1)
        })
    });
}

async function reqpser(user){
    return new Promise(async function(resolve, reject) {
        axios.post(`http://${config.hostname}:5000/addprovidedservice`, user)
        .then((res) => {
        //console.log(res.data)
        resolve(1)
        })
        .catch((error) => {
        //console.error(error)
        resolve(1)
        })
    });
}

async function addDiscountcoupon(user){
    return new Promise(async function(resolve, reject) {
        axios.post(`http://${config.hostname}:5000/adddiscountcoupon`, user)
        .then((res) => {
        //console.log(res.data)
        resolve(1)
        })
        .catch((error) => {
        //console.error(error)
        resolve(1)
        })
    });
}

for (n=0;n<srv.length;n+=2)
{
        sobj.category=srv[n]
        sobj.service=srv[n+1]
        srvlist.push(sobj)
        sobj={}
}
async function main()
{
    for(i=1;i<=100;i++)
    {
        user.uname="vendor"+i
        user.type="vendor"
        user.email="vendor"+i+"@gmail.com"
        user.phone_num=12345678*i
        user.pass="rty123"
        await reqregister(user)
        temp={}
        jk=Math.floor(0 + Math.random() * srvlist.length)
        temp=srvlist[jk]
        user.id=i
        user.category=temp.category
        user.service=temp.service
        user.price=(Math.floor(10 + Math.random() * 90))*100
        user.srv_desc="this is the service description"
        await reqpser(user)
        console.log(user)
        user={}
    }

    for(i=101;i<=200;i++)
    {
        user.uname="customer"+i
        user.type="customer"
        user.email="customer"+i+"@gmail.com"
        user.phone_num=12345678*i
        user.pass="rty123"
        await reqregister(user)
        console.log(user)
    }

    for(i=1;i<=22;i++)
    {
        user.srvcode=i
        user.coupon_code="50OFFCODE"+i
        user.discount_type="percent"
        user.discount_price=50
        user.valid_from="2020-07-09 16:41:00"
        user.valid_till="2020-07-16 10:00:00"
        await addDiscountcoupon(user)
        console.log(user)
    }
}

main()
