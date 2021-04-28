drop database K2GServices;
create database if not exists K2GServices;
use K2GServices;

create table KG_user(
	userid 		    bigint primary key auto_increment,
    usertype        varchar(20) not null,
	uname		    varchar(255) unique not null,
	email		    varchar(511) not null,
	phone_num	    varchar(15) not null,
    picture         varchar(255),
    location        varchar(25),
    ver_email       tinyint default 0,
    ver_phno        tinyint default 0,
    ver_code        bigint,
    ver_smscode     bigint,
    secret_code     varchar(127),
    code_verified   tinyint default 0,
    unique(usertype,email),
    unique(usertype,phone_num)
);

create table KG_user_address(
	userid 		    bigint primary key,
    location        varchar(25),
    pincode         bigint not null check(pincode >=99999 and pincode <=1000000),
    country         varchar(25) not null,
    region          varchar(50) not null,
    district        varchar(50) not null,
    locality        varchar(500) not null,
    building_street varchar(500) not null, 
    landmark        varchar(200),
    foreign key (userid) references KG_user(userid)
);

create table KG_passwords(
    userid      bigint primary key not null,
    password    varchar(511) not null,
    salt        varchar(11),
    foreign key (userid) references KG_user(userid)    
);

create table KG_provided_services(
    vendor_id         bigint not null,
    srvcode           bigint not null,
    price             bigint not null,
    srv_description   varchar(1000),
    avl_time          varchar(20),
    location          varchar(25),
    foreign key (vendor_id) references KG_user(userid),
    constraint psrv primary key(vendor_id,srvcode)
);

create table KG_required_services(
    customer_id         bigint primary key,
    srvcode             bigint not null,
    booked              tinyint not null,
    foreign key (customer_id) references KG_user(userid)
);

create table KG_booked_services(
	service_id	        bigint primary key auto_increment,
	vendor_id           bigint not null,
	customer_id         bigint not null,
	srvcode		        bigint not null,
    cur_status          tinyint default 0,
    price               bigint not null, -- cgst sgst
    srvtime             datetime not null,
    endtime             datetime not null,
    booked_date	        datetime not null,
    pincode             bigint not null check(pincode >=99999 and pincode <=1000000),
    country             varchar(25) not null,
    region              varchar(50) not null,
    district            varchar(50) not null,
    locality            varchar(500) not null,
    building_street     varchar(500) not null, 
    landmark            varchar(200),
	rating		        int,
    comments            varchar(511),
    foreign key (vendor_id) references KG_provided_services(vendor_id)
);

create table KG_service_discount(
    discount_id         bigint primary key auto_increment,
    srvcode             int not null,
    coupon_code         varchar(15) unique not null,
    discount_percent    int default 0,
    discount_value      bigint default 0,
    date_created        datetime not null,
    valid_from          datetime not null,
    valid_till          datetime not null,
    constraint discount_percent check(discount_percent >=0 and discount_percent <=99)
);

create table KG_payment(
    payment_id      bigint primary key auto_increment,
    service_id      bigint unique not null,
    discount_id     bigint,
    price           bigint not null,
    cgst            bigint not null,
    sgst            bigint not null,
    igst            bigint not null,
    pay_status      tinyint not null,
    payment_date    date,
    foreign key (service_id) references KG_booked_services(service_id),
    foreign key (discount_id) references KG_service_discount(discount_id)
);

create table KG_scode(
    srvcode     bigint primary key auto_increment,
    srvcategory varchar(127) not null,
    subsrv      varchar(127) not null
);

create table KG_images(
    imgpath         varchar(500) not null,
    imgcategory     varchar(80) not null,
    unique(imgpath,imgcategory)
);

insert into KG_scode (srvcategory, subsrv) values
('Home Design and Construction','Architect model'),
('Home Design and Construction','Interior Designer'),
('Home Design and Construction','Modular Kitchen'),
('Home Design and Construction','Painters for House/ office coloring'),
('Home Design and Construction','CCTV Cameras installation'),
('Home Moving and Shifting','Packers and movers'),
('Home Moving and Shifting','Pest control'),
('Home Moving and Shifting','Water Tank'),
('Home Cleaning and Repair','Electricals and Electronic Repair'),
('Home Cleaning and Repair','Plumbing'),
('Home Cleaning and Repair','Carpentry'),
('Tutors and Lessons','Home tutor'),
('Party and Event Services','Wedding planner'),
('Party and Event Services','Bridal Makeup'),
('Party and Event Services','Pre and post wedding photography'),
('Party and Event Services','Birthday Party organizer'),
('Party and Event Services','Event organizer'),
('Health and Wellness','Physiotherapy'),
('Health and Wellness','Dietician'),
('Health and Wellness','Yoga and Fitness Trainer at Home'),
('Business','Web Designer and Developer'),
('Business','CA for Taxation to Small Business');

