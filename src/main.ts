
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
        var same: number = 0;
        var percent: number = 0;
        var total = firstObjects.length * toIntersect.length;
        for(var i: number = 0; i < firstObjects.length; i ++){
            for(var j: number = 0; j < toIntersect.length; j ++){
                if(firstObjects[i].$path === toIntersect[j].$path){
                    same ++
                    continue;
                }
                percent++;
               
                var dwgModel = await intercept.findIntersection(firstObjects[i], toIntersect[j], true);

                ctx.setStatusBarMessage(`Обработано ${percent+1} из ${total}, ${Math.ceil(percent / total * 100.)}%.`+
                ` Затрачено времени: ${Math.ceil((new Date().getTime() - startTime)/1000)}c.`+
                ` Найдено пересечений: ${count}. Совпадений: ${same}  `);
                
                if(dwgModel)
                    count ++;
            }
        }
        const endTime = new Date().getTime();
        //var dwgModel = await intercept.findIntersection(result[0], result[1]) as DwgModel3d;
        // console.log(count);
        ctx.setStatusBarMessage("Прогресс 100%", 0.5);
        ctx.showMessage(`Найдено пересечений: ${count} \nЗатрачено времени: ${Math.ceil((endTime - startTime)/1000)}c`+
                        `\nСовпадений: ${same} ` )
    }
}
