let args=[1,2,34,{data:"test"}];

class TT{
    constructor(){

    }
    test(a,b,c,d) {
        console.log(a,b,c,d);
    }
}
  

 let obj=new TT();
 obj['test'](...args);
 