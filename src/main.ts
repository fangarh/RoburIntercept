
import { AnnotationHelper, InterceptData } from './annotation';
import { IntersectionFinder3 } from './interceptor3';
import { Selector } from './selector';
import { createApp } from 'vue';
import IntersectionsView from './vue/IntersectionsView.vue';

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

        const m1 = await Math3d.geometry.createUuidMaterial({ shading: 'Blinn–Phong', diffuse: 8421504, 
            specular: 14277081, ambient: 3021070, shininess: 0.2, transparency: 50 });
        const m2 = await Math3d.geometry.createUuidMaterial({ shading: 'Blinn–Phong', diffuse: 8355711, 
                specular: 12632256, ambient: 3021070, shininess: 0.2, transparency: 50 });

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
        var old_percent = 0
        const progress = ctx.beginProgress();
        progress.indeterminate = false;
        for(var i: number = 0; i < firstObjects.length; i ++){
            for(var j: number = 0; j < toIntersect.length; j ++){

                if(old_percent  + 1 < Math.ceil(percent / total * 100.)){
                    old_percent =  Math.ceil(percent / total * 100.)
                    const promise = new Promise<void>((resolve) => {
                        setTimeout(() => { resolve() }, 0);
                    });
                    await promise;
                }

                if(firstObjects[i].$path === toIntersect[j].$path){
                    same ++
                    continue;
                }

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
        //console.log(JSON.stringify(inter));

        (ctx.extension as any).intersections = inter;

        // Вызов команды для отображения вьюхи
        //await ctx.eval('intersections_mount');
        //await ctx.eval('extension.helloRoburView')
    },
  'extension.helloRoburView': async (ctx: Context): Promise<DefinedView> => {
    return new HelloRoburView(ctx.extension);
  }
}

class HelloRoburView implements DefinedView {
  readonly id = 'helloRoburView';  
  readonly weight = 1;
  expanded = true;

  constructor(public readonly extension: Extension) {
    console.log("loaded")
  }

  get settings() {
    return this.extension.settings('');
  }

  get onDidBroadcast() {
    return () => ({ dispose() {} });
  }

  render(container: HTMLElement) {
    console.log('Mount called');
    container.innerText = 'Hello robur';
    container.style.padding = '8px';
    container.style.fontSize = '16px';
    container.style.fontFamily = 'sans-serif';
  }
}



