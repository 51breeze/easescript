package test;

import test.Component;

public class InferReturn{

    start(){
        this.list();
        this.items();
        this.filter(1)
        this.getRest()
        this.success({})
        this.pick([], 0, 0)
    }

    list(){
        const group:{[key:string]:string} = {};
        return Object.keys( group ).map( name=>{
            return {
                name:name,
                count:1,
            }
        });
    }

    items(){
        return [
            {
                name:'sss',
                age:20,
                address:''
            },
            {
                name:'sss',
                age:20,
                nickname:'ssss',
                flag:false
            }
        ]
    }

    filter( flag:number ){
        if( flag ==1 ){
            return {name:'zh'}
        }else if( flag==2 ){
            return {age:30, name:'222'}
        }
        return null;
    }

    getRest(){
        if(1){
            return 'name'
        }else{
            if(2){
                return 1
            }else{
                if(9){
                    return true
                }else{
                    return false;
                }
            }
        }
    }

    getVoid(){
        if(1){
            return 'name'
        }
    }

    success<T>(data:T, code:number=200, msg:string='ok'){
        return json({data, code, msg}, 200)
    }

    private pick(nodes:Record[], x:number, y:number){
        let len = nodes.length;
        for(let i=len; i > 0;i--){
            let node = nodes[i-1];
            const {content} = node.el as {content:HTMLElement}
            let bounds:DOMRect = null
            if(content){
                bounds = content.getBoundingClientRect()
                if(x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y){
                    const pos = y > bounds.y + bounds.height / 2 ? 'after' : 'before';
                    if(!node.expanded && y <= bounds.y + bounds.height){
                        if(node.target.allowDragDrop){
                            return [node, 'inner', bounds]
                        }else{
                            return [node, pos, bounds]
                        }
                    }else{
                        if(node.expanded && node.target.allowDragDrop){
                            const result = this.pick(node.children, x, y);
                            if(result){
                                return result;
                            }else{
                                const next999 = node.nextSibling() as Record | null;
                                if(next999){
                                    return [next999, 'before',bounds]
                                }else{
                                    return [node, 'after',bounds]
                                }
                            }
                        }else{
                            return [node, pos, bounds]
                        }
                    }
                }
            }
            if(node.target.allowDragDrop){
                const result = this.pick(node.children, x, y);
                if(result){
                    return result;
                }
            }
        }
        return null;
    }

    testReturnClassGenericType(){
        const loadRemoteData = async()=>{
            return ['', 1]
        }
        Promise.all(
            Array.from([1]).map(loadRemoteData)
        )
    }

}