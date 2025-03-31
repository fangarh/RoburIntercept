
import { IntersectionFinder2 } from './interceptorv2';
import { Selector } from './selector';


export default {
    intercept:async (ctx: Context) => {
        const select = new Selector(ctx);
        const intercept = new IntersectionFinder2(ctx);
  
        var result = await select.getSelectedDwgEntities();
       // var result1 = await select.selectedDwgEntities();
    
       // ctx.showMessage("compleated " + result1.length);

        var dwgModel = await intercept.findIntersection(result[0], result[1]) as DwgModel3d;
        //console.log(dwgModel);
        ctx.showMessage("Meshes "+dwgModel.meshes.length)
    }
}
