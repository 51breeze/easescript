function getExpression(body, at){
    return body[at].expression;
}

function getDeclarator(body, at){
    return body[at].declarations[0];
}

function fromat(str){
    return str.replace(/[\s\r\n]/g,'')
}

function getExpString( body, pos ){
    return fromat( getExpression(body,pos).type().toString() );
}

function getDeclString( body, pos ){
    const exp = getDeclarator(body,pos);
    return fromat( exp.type().toString(exp.getContext()) );
}

function getExpFunString( body, pos ){
    let exp = getExpression(body,pos);
    let desc = exp.description();
    if( desc ){
        return fromat( desc.getFunType().toString( exp.getContext() ) )
    }else{
        return 'description is not exists';
    }
}

function getExpCallArgmentString(body, pos, index){
    let exp = getExpression(body,pos);
    let arg = exp.arguments[index];
    if( arg ){
        return fromat( arg.type().toString( exp.getContext() ) )
    }else{
        return 'Arguments is not exists';
    }
}

function createError(errors, msg='', code=0, kind=0, line=0){
    const error = errors.find( item=>{
        if(kind >= 0 && item.kind !== kind )return false;
        if(code >= 0 && item.code !== code )return false;
        if(line > 0 && item.range?.start?.line !== line)return false;
        if(msg && item.message.replace(/[\s\r\n]+/g,'') !== msg.replace(/[\s\r\n]+/g,'') )return false;
        return true
    });
    const index = errors.indexOf(error);
    if( index >= 0 ){
        const error = errors[index];
        errors.splice(index,1);
        createError(errors, msg, code, kind, error.range?.start?.line)
    }

    if( error ){
        return [msg, error.message]
    }

    return [msg.trim(),'(Not found error) : '+msg];
}

module.exports = {
    getExpression,
    getDeclarator,
    fromat,
    getExpString,
    getDeclString,
    getExpFunString,
    getExpCallArgmentString,
    createError
}