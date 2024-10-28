class Range{
    static is(value){
        return value ? value instanceof Range : false;
    }
    constructor(start,end){
        this.start = start;
        this.end = end;
    }
}
module.exports = Range;