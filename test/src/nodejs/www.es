export var site = 'www';
export function test(val:string){
    return val.includes('http://')
}

const database = 'mysql';
const password = '123'
const username = 'root'

export {database, password, username}