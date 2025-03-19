import { Interceptor } from './interceptor';
import { Selector } from './selector';


export default {
    intercept:async (ctx: Context) => {
        const select = new Selector(ctx);
        const intercept = new Interceptor();
      
        var result = await select.getSelectedDwgEntities();
     
        var editor = ctx.cadview?.layer.drawing?.layout.editor();
        await editor?.beginEdit();
        try{  

            for( var i = 0; i < result.length; i ++ ){
                var vertex = await select.getTrianglesFromEntity(result[i]);
       
                for(var j = 0; j < vertex.length; j ++){
                             
                    for(var k = 0; k < vertex[j].length - 1; k ++){
                        await editor?.addLine({
                            a: vertex[j][k],
                            b: vertex[j][k+1],
                            color: i +4
                            });                   
                    }

                    await editor?.addLine({
                        a: vertex[j][0],
                        b: vertex[j][vertex[j].length - 1],
                        color: i +4
                        });
                    

                }
            }
        }finally{
            await editor?.endEdit();
        } 

        if(result.length > 1){
            var poly1 = await select.getTrianglesFromEntity(result[0]);
            var poly2 = await select.getTrianglesFromEntity(result[1]);

            var vertex = intercept.intersect(poly1, poly2);
            console.log(vertex.length)            
        }else{
            ctx.showMessage("Need more polygons")
        }
        
        ctx.showMessage("compleated");
    }
}
