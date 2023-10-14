package bug;
class Spec1 {
    start(){
        this.shortcutTelmplates;
    }

    @Reactive
    private setting:{lang:string,value:{shortcutTelmplates:{content:string}[]}}[] = [];

    private lang:string;

    get shortcutTelmplates(){
        const list =  this.setting;
        if( list && list.length > 0 ){
            const data = list.find( item99633=>item99633.lang === this.lang );
            if( data ){
                return data.value.shortcutTelmplates;
            }
        }
        return [];
    }

}