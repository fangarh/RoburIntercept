
import { IntersectionFinder3 } from './interceptor3';
import { Selector } from './selector';


var iter:number = 0;
export default {
    intercept:async (ctx: Context) => {
        const select = new Selector(ctx);
        const intercept = new IntersectionFinder3(ctx);

        ctx.cadview?.annotations.standard.clear();
        var firstObjects = await select.getSelectedDwgEntities();
        var toIntersect = await select.selectDwgEntities("Выберите объекты для пересечения");
        const startTime = new Date().getTime();
        var count: number = 0;
        for(var i: number = 0; i < firstObjects.length; i ++){
            for(var j: number = 0; j < toIntersect.length; j ++){
                if(firstObjects[i].$id == toIntersect[j].$id)
                    continue;
                var dwgModel = await intercept.findIntersection(firstObjects[i], toIntersect[j]);

                if(dwgModel)
                    count ++;
            }
        }
        const endTime = new Date().getTime();
        //var dwgModel = await intercept.findIntersection(result[0], result[1]) as DwgModel3d;
        // console.log(count);
        ctx.showMessage(`Найдено пересечений: ${count} \nЗатрачено времени: ${endTime - startTime}ms \n${++iter} ` )
    }
}
