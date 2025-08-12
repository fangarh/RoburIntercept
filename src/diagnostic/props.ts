import {
  Context,
  ManifestPropertyProvider,
  ObjectPropertyProvider,
  PropertyItem,
  PropertySequenceUpdate,
} from "albatros";
// https://360-staging.topomatic.ru/?extensionDevelopmentPath=http%3A%2F%2Flocalhost%3A9091
import { Selector } from "../selector";
import { ConstructionHelper, ConstructionType } from "../constructions";

var constractions: any;
var ch: ConstructionHelper = new ConstructionHelper();
async function getConstructions(ctx: Context) {
  if (constractions == undefined) {
    const select = new Selector(ctx);
    ch.BuildConstructionTypes(await select.selectAll());
    constractions = ch
      .getConstructions()
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  return constractions;
}

declare interface Rule3d {
  filter: ConstructionType;
  filter2: ConstructionType;
  distance: number;
}

export const interceptProperties: Record<
  string,
  (e: Context & ManifestPropertyProvider) => ObjectPropertyProvider
> = {
  "property:firstConstruction": (e) => ({
    getProperties(objects: Rule3d[]) {
      return [
        {
          id: "firstConstruction",
          label: e.label ?? "Первая конструкция",
          description: e.description,
          value() {
            const value = objects[0].filter;
            console.log(objects[0].filter);
            for (let i = 1; i < objects.length; i++) {
              if (value !== objects[i].filter) {
                return {
                  label: e.tr("**Различные**"),
                };
              }
            }
            return {
              label: value,
            };
          },
          editor: async () => ({
            type: "editbox",
            buttons: e.app
              ? [
                  {
                    label: "...",
                    icon: "more_horiz",
                  },
                ]
              : [],
            async onDidTriggerItemButton() {
              var map = new Map<string, ConstructionType>();
              var constr = await getConstructions(e);
              //console.log(constr)
              for (var c of constr) {
                map.set(c.id, c.name);
              }

              const items = [...map.keys()].map((key) => {
                console.log("1", key, map.get(key));
                return {
                  key,
                  label: map.get(key)!,
                };
              });
              console.log(items);
              const item = await e.showQuickPick(items, {
                placeHolder: e.tr("Выберите поле"),
              });
              for (const object of objects) {
                try {
                  object.filter = item.key;
                } catch (e) {
                  console.error(e);
                }
              }
            },
            commit: (val) => {
              if (val !== undefined) {
                for (const object of objects) {
                  try {
                    (object as any)[e.field] = val;
                  } catch (e) {
                    console.error(e);
                  }
                }
              }
              //(e as any).set(val);
            },
          }),
        },
      ];
    },
  }),

  "property:secondConstruction": (e) => ({
    getProperties(objects: Rule3d[]) {
      return [
        {
          id: "secondConstruction",
          label: e.label ?? "Вторая конструкция",
          description: e.description,
          value() {
            const value = objects[0].filter2;
            console.log(objects[0].filter2);
            for (let i = 1; i < objects.length; i++) {
              if (value !== objects[i].filter2) {
                return {
                  label: e.tr("**Различные**"),
                };
              }
            }
            return {
              label: value,
            };
          },
          editor: async () => ({
            type: "editbox",
            buttons: e.app
              ? [
                  {
                    label: "...",
                    icon: "more_horiz",
                  },
                ]
              : [],
            async onDidTriggerItemButton() {
              var map = new Map<string, ConstructionType>();
              var constr = await getConstructions(e);
              //console.log(constr)
              for (var c of constr) {
                map.set(c.id, c.name);
              }

              const items = [...map.keys()].map((key) => {
                console.log("1", key, map.get(key));
                return {
                  key,
                  label: map.get(key)!,
                };
              });
              console.log(items);
              const item = await e.showQuickPick(items, {
                placeHolder: e.tr("Выберите поле"),
              });
              for (const object of objects) {
                try {
                  object.filter2 = item.key;
                } catch (e) {
                  console.error(e);
                }
              }
            },
            commit: (val) => {
              if (val !== undefined) {
                for (const object of objects) {
                  try {
                    (object as any)[e.filter2] = val;
                  } catch (e) {
                    console.error(e);
                  }
                }
              }
              //(e as any).set(val);
            },
          }),
        },
      ];
    },
  }),

  "property:minDepth": (e) => ({
    getProperties(objects: Rule3d[]) {

      const field = e.field;
      if (field === undefined) {
        return [];
      }
      return [
        {
          id: `minDepth-${field}`,
          label: e.label ?? "Минимальная глубина пересечения",
          description: e.description,
          value: ()=> { 
            
            return {
            
            label: (objects[0] as any)[e.field]?.toString() ?? "",
            suffix: "мм",
          }},
          editor: () => ({
            type: "editbox",
            commit: (val) => {
              const number = parseFloat(val);
              for (const object of objects) {
                try {
                  (object as any)[e.field] = number;
                } catch (e) {
                  console.error(e);
                }
              }
            },
            validate: (val) => {
              return isNaN(parseFloat(val)) ? e.tr("Введите число") : undefined;
            },
          }),
        },
      ];
    },
  }),
};
