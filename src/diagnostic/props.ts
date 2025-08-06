import { Context, ManifestPropertyProvider, ObjectPropertyProvider, PropertyItem, PropertySequenceUpdate } from 'albatros';

export const interceptProperties: Record<string, (e: Context & ManifestPropertyProvider) => ObjectPropertyProvider> = {
  'property:firstConstruction': (e) => ({
    getProperties() {
      return [{
        id: 'firstConstruction',
        label: e.label ?? 'Первая конструкция',
        description: e.description,
        value: () => ({ label: e.value ?? e.tr('Не выбрано') }),
        editor: () => ({
          type: 'dropdown',
          options: (e as any).constructions?.map((c: any) => ({
            label: c.name,
            value: c.name,
          })) ?? [],
          commit: (val) => {
            if (val !== undefined) (e as any).set(val);
          }
        })
      }];
    }
  }),

  'property:secondConstruction': (e) => ({
    getProperties() {
      return [{
        id: 'secondConstruction',
        label: e.label ?? 'Вторая конструкция',
        description: e.description,
        value: () => ({ label: e.value ?? e.tr('Не выбрано') }),
        editor: () => ({
          type: 'dropdown',
          options: (e as any).constructions?.map((c: any) => ({
            label: c.name,
            value: c.name,
          })) ?? [],
          commit: (val) => {
            if (val !== undefined) (e as any).set(val);
          }
        })
      }];
    }
  }),

  'property:minDepth': (e) => ({
    getProperties() {
      return [{
        id: 'minDepth',
        label: e.label ?? 'Минимальная глубина пересечения',
        description: e.description,
        value: () => ({
          label: e.value?.toString() ?? '',
          suffix: 'мм',
        }),
        editor: () => ({
          type: 'editbox',
          commit: (val) => {
            const number = parseFloat(val);
            if (!isNaN(number)) (e as any).set(number);
          },
          validate: (val) => {
            return isNaN(parseFloat(val)) ? e.tr('Введите число') : undefined;
          }
        })
      }];
    }
  }),
};