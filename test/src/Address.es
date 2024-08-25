package;

struct table Address{
  id: int(11) auto_increment,
  uid:int(11),
  area: varchar(255) DEFAULT '',
  content: varchar(255) DEFAULT '',
  phone: varchar(16) DEFAULT '' ,
  postcode?: varchar(32),
  status?: enum(com.Types),
  type?: enum(1,2,3),
  PRIMARY KEY(id, postcode)
  UNIQUE KEY pidid(id)
}