
import { AnnotationHelper, InterceptData } from './annotation';
import { IntersectionFinder3 } from './interceptor3';
import { Selector } from './selector';

var data: any;
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
                specular: 12256, ambient: 3070, shininess: 0.6, transparency: 20 });

        const inter : InterceptData[] = [];

        var old_percent = 0
        const progress = ctx.beginProgress();
        const lengthNormal : vec3 = [0,1,0];
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

                var dwgModel = await intercept.findIntersection2(firstObjects[i], toIntersect[j], lengthNormal);
                    
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
        data = inter;
        ctx.endProgress(progress);
        var ch = ctx.createOutputChannel("intercept")
        ch.info(`Найдено пересечений: ${inter.length} \nЗатрачено времени: ${Math.ceil((endTime - startTime)/1000)}c\n`+
                        `Совпадений: ${same} ` );        
        for(var i: number = 0; i < inter.length; i ++){
          if(inter[i].length == undefined)continue;
          
          if(inter[i].length.projectedDistance > 5)
            ch.warn(`${i}:${inter[i].model1.$id} -> ${inter[i].model2.$id} : Глубина пересечения по XZ ${inter[i].length?.projectedDistance}`)
          else
            ch.info(`${i}:${inter[i].model1.$id} -> ${inter[i].model2.$id} : Глубина пересечения по XZ ${inter[i].length?.projectedDistance}`)
        }
    },
  'extension.helloRoburView': async (ctx: Context): Promise<DefinedView> => {
    var v = new HelloRoburView(ctx.extension);
    v.render(ctx.el)
    return v;
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
    container.innerText = 'Hello robur' + data?.length;
    container.style.padding = '8px';
    container.style.fontSize = '16px';
    container.style.fontFamily = 'sans-serif';
  }
}



