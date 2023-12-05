function asyncF(timer, value){
    return new Promise((resolve)=>{
        setTimeout(()=>resolve(value), timer)
    })
}

const task = [[1000, 1], [500, 2]]

task.forEach( async ([timer, value])=>{
    const val = await asyncF(timer,value);
    console.log( val );
})

console.log('-----forEach------')


const call = async ([timer, value])=>{
    const val = await asyncF(timer,value);
    console.log( val );
}

async function enter(){

    const task = [[1000, 3], [500, 4]]
    await Promise.allSettled(task.map( item=>call(item) ));
    console.log('-----enter------')
}

enter();



