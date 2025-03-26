import { IntersectionFinder } from './interceptor';
import { Selector } from './selector';


export default {
    intercept:async (ctx: Context) => {
        const select = new Selector(ctx);
        const intercept = new IntersectionFinder(ctx);
  
        var result = await select.getSelectedDwgEntities();
             
        ctx.showMessage("compleated " + result.length);

        var dwgModel = await intercept.createIntersectionModel(result[0], result[1]);
        //console.log(dwgModel);
        ctx.showMessage("Meshes "+dwgModel.meshes.length)
    }
}
