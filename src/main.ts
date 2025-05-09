
import { AnnotationHelper, InterceptData } from './annotation';
import { IntersectionFinder3 } from './interceptor3';
import { Selector } from './selector';

export default {
    intercept:async (ctx: Context) => {
        const select = new Selector(ctx);
        const intercept = new IntersectionFinder3(ctx);

        ctx.cadview?.annotations.standard.clear();
        var firstObjects = await select.getSelectedDwgEntities();
        var toIntersect = await select.selectDwgEntities("Выберите объекты для пересечения");
        const startTime = new Date().getTime();

        var same: number = 0;
        var percent: number = 0;
        var total = firstObjects.length * toIntersect.length;

        const m1 = await Math3d.geometry.createUuidMaterial({ shading: 'Blinn–Phong', diffuse: 0xff000000, 
            specular: 0xff000000, ambient: 0xff000000, shininess: 0, transparency: 50 });
        const m2 = await Math3d.geometry.createUuidMaterial({ shading: 'Blinn–Phong', diffuse: 0xffff0000, 
                specular: 0xffff0000, ambient: 0xffff0000, shininess: 0, transparency: 50 });

        const inter : InterceptData[] = [];
/*
        const progress1 = ctx.manager.beginProgress();
        progress1.indeterminate = false;
        for (let i = 0; i < 100; ++i) {
            const percents = i + 1;
            progress1.label = `${Math.round(percents)}%`;
            progress1.percents = percents;
            progress1.details = ctx.tr('Детали');
            const promise = new Promise<void>((resolve) => {
                setTimeout(() => { resolve() }, 100);
            });
            await promise;
        }
        ctx.manager.endProgress(progress1);*/
        
        const progress = ctx.beginProgress();
        progress.indeterminate = false;
        for(var i: number = 0; i < firstObjects.length; i ++){
            for(var j: number = 0; j < toIntersect.length; j ++){
                if(firstObjects[i].$path === toIntersect[j].$path){
                    same ++
                    continue;
                }

                const promise = new Promise<void>((resolve) => {
                    setTimeout(() => { resolve() }, 0);
                });
                await promise;
                var dwgModel = await intercept.findIntersection2(firstObjects[i], toIntersect[j]);
                    
                progress.label = `${Math.round(Math.ceil(percent / total * 100.))}%`;
                progress.percents = Math.ceil(percent / total * 100.);
                progress.details = ctx.tr('Поиск...');
                percent++;
                if(dwgModel){
                    inter.push(dwgModel);
                    const annotations = new AnnotationHelper([dwgModel], ctx, m1, m2);
                    await annotations.setAnnotations();
                }
                
            }
        }


        const endTime = new Date().getTime();

        
        


        ctx.endProgress(progress);
        ctx.showMessage(`Найдено пересечений: ${inter.length} \nЗатрачено времени: ${Math.ceil((endTime - startTime)/1000)}c\n`+
                        `Совпадений: ${same} ` );
        console.log(JSON.stringify(inter));
    }
}
