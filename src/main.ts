import { Interceptor } from './interceptor';
import { Selector } from './selector';


export default {
    intercept:async (ctx: Context) => {
        const select = new Selector(ctx);
        const intercept = new Interceptor();
      
        var result = await select.getSelectedDwgEntities();
             
        ctx.showMessage("compleated " + result.length);
    }
}
