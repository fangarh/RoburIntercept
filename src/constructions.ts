/** 
 * ConstructionType — класс/обёртка уровня приложения.
 * Ответственность: инкапсулировать сценарии, сохранять состояние, предоставлять методы высокого уровня.
  * @throws Ошибка валидации входных данных или несовместимый тип фигуры
 */

export class ConstructionType {
  constructor(
    public id: string,
    public name: string
  ) {}
}

/** 
 * ConstructionPair — класс/обёртка уровня приложения.
 * Ответственность: инкапсулировать сценарии, сохранять состояние, предоставлять методы высокого уровня.
 * @throws Ошибка валидации входных данных или несовместимый тип фигуры
 */
export class ConstructionPair  {
   constructor(
      public first: ConstructionType,
      public second: ConstructionType){  }
}


export class ConstructionHelper {
  private constructions: ConstructionType[] = [];
  private constructionPairs: ConstructionPair[] = [];

  /**
   * Строит коллекцию уникальных ConstructionType на основе массива DwgModel3d
   * и сохраняет результат во внутреннее поле constructions.
   * Пропускает объекты, где id или name не определены.
   *
   * @param models массив объектов типа DwgModel3d
   */
  BuildConstructionTypes(models: DwgModel3d[]): void {
    const seen = new Set<string>();
    this.constructions = [];
    for (const model of models) {
      const id = model.layer?.typed?.$id;
      const name = model.layer?.typed?.name;
      if (id == null || name == null) continue;
      const key = `${id}|${name}`;
      if (!seen.has(key)) {
        seen.add(key);
        this.constructions.push(new ConstructionType(id, name));
      }
    }
  }

hasConstructionPairFromModels(model1: DwgModel3d, model2: DwgModel3d): boolean {
  const getIdAndName = (model: DwgModel3d): [string, string] | null => {
    const id = model.layer?.typed?.$id;
    const name = model.layer?.typed?.name;
    return id && name ? [id, name] : null;
  };

  const info1 = getIdAndName(model1);
  const info2 = getIdAndName(model2);

  if (!info1 || !info2) return false;

  const [id1, name1] = info1;
  const [id2, name2] = info2;

  if(this.constructionPairs.length < 1)return true;

  var res = this.constructionPairs.some(p =>
    (p.first.id === id1 && p.first.name === name1 && p.second.id === id2 && p.second.name === name2) ||
    (p.first.id === id2 && p.first.name === name2 && p.second.id === id1 && p.second.name === name1)
  );
  
  return res;
}


  /**
   * Добавить пару конструкций в коллекцию ConstructionPair.
   * Добавление происходит только если такой пары ещё нет (учитывая оба порядка).
   * @param pair Пара конструкций
   */
  addConstructionPair(pair: ConstructionPair): void {
    const isSamePair = (p1: ConstructionPair, p2: ConstructionPair): boolean => {
      const a1 = p1.first, b1 = p1.second;
      const a2 = p2.first, b2 = p2.second;

      return (
        (a1.id === a2.id && a1.name === a2.name && b1.id === b2.id && b1.name === b2.name) ||
        (a1.id === b2.id && a1.name === b2.name && b1.id === a2.id && b1.name === a2.name)
      );
    };

    const exists = this.constructionPairs.some(existingPair => isSamePair(existingPair, pair));

    if (!exists) {
      this.constructionPairs.push(pair);
    }
  }
  /**
   * Получить текущую коллекцию ConstructionType
   */
  getConstructions(): ConstructionType[] {
    return this.constructions;
  }

  removeConstructionPair(pair: ConstructionPair): void {
    this.constructionPairs = this.constructionPairs.filter(p =>
      !(p.first.id === pair.first.id &&
        p.first.name === pair.first.name &&
        p.second.id === pair.second.id &&
        p.second.name === pair.second.name)
    );
  }

  /**
   * Получить текущую коллекцию ConstructionPair
   */
  getConstructionPairs(): ConstructionPair[] {
    return this.constructionPairs;
  }
}