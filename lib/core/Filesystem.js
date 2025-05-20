const events = require('events');
const path = require('path');
const fs = require('fs');
class Filesystem extends events.EventEmitter{

   static getDirectoryFiles(pathName, isFull ){
        if( !fs.existsSync(pathName) ){
            return null;
        }
        var files = fs.readdirSync( pathName );
        files = files.filter(function(a){
            return !(a==='.' || a==='..');
        });
        if( isFull ){
            return files.map(function(name){
                return path.join(pathName,name);
            })
        }
        return files;
    }

    static join(pathName,name){
        return path.join(pathName,name);
    }

    static isDir( path ) {
        var fileStat = fs.existsSync(path) ? fs.statSync(path) : null;
        return fileStat ? fileStat.isDirectory() : false;
    }

    static getResolve(root, name){
        if( name && path.isAbsolute(name) ){
            return name;
        }
        return path.resolve(root, name ? name : '.');
    }

    static getRelative(from, to){
        return path.relative(from, to);
    }

    static getStat(path){
        return fs.statSync(path);
    }

    static readFile(path){
        return fs.readFileSync(path);
    }

    static isAbsolute( pathname ){
        return path.isAbsolute( pathname )
    }

    constructor(pathname=null,isDir=false){
        super();
        this.children=new Map();
        this.path=pathname;
        this.parent = null;
        this.isDir=isDir;
        this.content = [];
        this.before = [];
        this.after = [];
    }

    setPath(pathName){
        this.path = pathName;
        this.isDir = fs.statSync(pathName).isDirectory;
    }

    basename(filepath, suffix=''){
        return path.basename( filepath , suffix );
    }

    createFile(pathName){
        if( !this.isDir ){
            throw new Error(`'${this.path}' is not dir.`)
        }
        pathName = path.resolve(pathName);
        const filesystem = new Filesystem(pathName);
        filesystem.parent = this;
        this.children.set(pathName, filesystem );
        return filesystem;
    }

    createDir(pathName){
        if( !this.isDir ){
            throw new Error(`'${this.path}' is not dir.`)
        }
        pathName = path.resolve(pathName);
        const filesystem = new Filesystem(pathName,true);
        filesystem.parent = this;
        this.children.set(pathName, filesystem );
        return filesystem;
    }

    readdir(isFull){
        if(  !this.isDir || !fs.existsSync(this.path) ){
            throw new Error(`'${this.path}' is not dir or is not exists.`)
        }
        var files = fs.readdirSync( this.path );
        files = files.filter(function(a){
            return !(a==='.' || a==='..');
        });
        if( isFull ){
            return files.map((name)=>{
                return path.join(this.path,name);
            })
        }
        return files;
    }

    write( content ){
        if( this.isDir ){
            throw new Error(`'${this.path}' is not file.`)
        }
        this.content.push( content );
        return this;
    }

    writeBefore(content){
        this.before.push(content);
        
    }

    writeAfter(content){
        this.after.push(content);
    }

    read( pathName ){
        if( !pathName ){
            return this.toString();
        }
        pathName = path.resolve(pathName);
        const filesystem = this.children.get( pathName );
        if( !filesystem ){
            return fs.readFileSync( pathName );
        }
        return filesystem.toString();
    }

    getRelativePath(from){
        return path.relative(from, this.path);
    }

    join(...args){
        return path.join.apply(path.join, args);
    }

    replaceSuffix(file, suffix){
        const info = path.parse(file);
        if( info.ext === suffix ){
            return file;
        }
        return path.join(info.dir,info.name+suffix);
    }

    toPath(output, from, suffix){
        if( !suffix ){
            suffix = path.extname(this.path);
        }
        if( !from ){
            from = path.dirname(this.path);
        }
        return this.replaceSuffix( path.resolve(output, this.getRelativePath(from)), suffix);
    }

    mkdir( pathName ){
        if( fs.existsSync(pathName) ){
            return pathName;
        }
        const segments = pathName.replace(/\\/g,'/').split(/\//);
        let dirname = segments[0].lastIndexOf(":") ? segments.shift() + '/' : '';
        do{
            dirname+=segments.shift() + '/';
            if( !fs.existsSync(dirname) ){
                fs.mkdirSync(dirname);
            }
        }while( segments.length > 0 );
        return path.resolve(dirname);
    }

    persistent( pathName, content=null ){
        pathName = typeof pathName ==="function" ? pathName(this) : pathName;
        this.mkdir( path.dirname(pathName) );
        fs.writeFileSync(pathName, content || this.toString() );
    }

    toString(){
        if( this.isDir ){
            let content = ''
            this.children.forEach( child=>{
                content+=child.toString();
            });
            return this.before.join("")+content+this.after.join("");
        }else{
            return this.before.join("")+this.content.join("")+this.after.join("");
        }
    }
}
module.exports = Filesystem;