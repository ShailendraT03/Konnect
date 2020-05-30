create database if not exists K2GServices;
use K2GServices;

create table KG_customer(
	customer_id 		bigint primary key auto_increment,
	uname		varchar(255) unique not null,
	email		varchar(511) unique not null,
	phone_num	int(10) unique not null,
    location    varchar(25),
    ver_email   tinyint default 0,
    ver_phno    tinyint default 0
);

create table KG_bookedservices(
    customer_id         bigint primary key,
    category    varchar(50) not null,
    srvice      varchar(50) not null,
    booked      tinyint not null,
    foreign key(customer_id) references KG_customer(customer_id)
);

create table KG_vendor(
	vendor_id 		bigint primary key  auto_increment,
    uname		varchar(255) unique not null,
	email		varchar(511) unique not null,
	phone_num	int(15),
    location    varchar(25),
    service_type    varchar(50) not null,
	prvd_service	varchar(50) not null
);

create table KG_passwords(
    userid      bigint not null,
    usertype    varchar(20) not null,
    password    varchar(511) not null,
    salt        varchar(11),
    constraint pass primary key(userid,usertype)
);

create table KG_provided_srvices(
    vendor_id         bigint not null,
    srvice      varchar(50) not null,
    price       bigint not null,
    avl_time    varchar(20),
    location    varchar(25),
    constraint psrv primary key(vendor_id,srvice)

);

create table KG_services(
	service_id	bigint primary key auto_increment,
	vendor_id         bigint not null,
	customer_id     	bigint not null,
	srvice		varchar(50) not null,
	servicedate	date not null,
	rating		int,
    comments    varchar(511)
);


