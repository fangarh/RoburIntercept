<template>
  <div class="intercept-table-view">
    <h2 class="title">Выбор конструкций</h2>

    <div class="select-grid">
      <div>
        <label>Первая конструкция</label>
        <select v-model="selectedFirst" class="select">
          <option v-for="c in constructions" :key="c.id" :value="c">
            {{ c.name }}
          </option>
        </select>
      </div>

      <div>
        <label>Вторая конструкция</label>
        <select v-model="selectedSecond" class="select">
          <option v-for="c in constructions" :key="c.id" :value="c">
            {{ c.name }}
          </option>
        </select>
      </div>
    </div>

    <button @click="addPair" class="add-btn">
      Добавить пару
    </button>

    <h3 class="subtitle">Выбранные пары:</h3>
    <ul class="pair-list">
      <li
        v-for="(pair, index) in constructionPairs"
        :key="index"
        class="pair-item"
      >
        <span>{{ pair.first.name }} — {{ pair.second.name }}</span>
        <button @click="removePair(pair)" class="remove-btn">Удалить</button>
      </li>
    </ul>
    <h2>
      Пересечения
      <span v-if="filteredData">({{ filteredData.length }} из {{ data?.length ?? 0 }})</span>
    </h2>

    <div v-if="!data || data.length === 0">
      <p>Данные не загружены или отсутствуют.</p>
    </div>

    <div v-else>
      <div class="filter-block">
        <label for="filter">Минимальная глубина (Projected Distance):</label>
        <input
          id="filter"
          type="number"
          v-model.number="filterValue"
          placeholder="Введите число"
        />
      </div>

      <table>
        <thead>
          <tr>
            <th>Первый объект</th>
            <th>Второй объект</th>
            <th>Глубина</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in filteredData" :key="index">
            <td>{{ formatObjectId(item.model1) }}</td>
            <td>{{ formatObjectId(item.model2) }}</td>
            <td>{{ formatDistance(item.length?.projectedDistance) }}</td>
            <td>
              <a href="#" @click.prevent="intersectionAction(item)">
                Пересечения
              </a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType, ref, computed, onMounted  } from 'vue';
import { ConstructionHelper, ConstructionType, ConstructionPair } from './../constructions';
import './style/InterceptTable.css'; //  обновлённый путь к стилю

interface vec3 extends Array<number> {
  0: number;
  1: number;
  2: number;
}

interface DwgModel3d {
  $id?: string;
  $path: string;
}

interface ProjectionLength {
  projectedDistance: number;
  vector: vec3;
}

interface Context {
  createOutputChannel(name: string): { warn(msg: string): void };
}

export interface InterceptData {
  model1: DwgModel3d;
  model2: DwgModel3d;
  interception: { a: vec3; b: vec3 }[];
  length: ProjectionLength | undefined;
}

export default defineComponent({
  name: 'InterceptTable',
  props: {
    constructions: {
      type: Array as () => ConstructionType[],
      required: true
    },
    constructionPairs: {
      type: Array as () => ConstructionPair[],
      required: true
    },
    ch: {
      type: Object,
      required: true
    },
    ctx: Object,
    data: {
      type: Array as PropType<InterceptData[]>,
      required: false
    }
  },
  setup(props) {
    const constructions = ref([...props.constructions]);
    const constructionPairs = ref([...props.constructionPairs]);
    const filterValue = ref<number>(5);
    const constructionTypes = ref<ConstructionType[]>([]);
    const selectedFirst = ref<ConstructionType | null>(null);
    const selectedSecond = ref<ConstructionType | null>(null);
    

    const filteredData = computed(() => {
      if (!props.data || !Array.isArray(props.data)) return [];
      return props.data.filter(item =>
        item.length?.projectedDistance !== undefined &&
        item.length.projectedDistance >= filterValue.value
      );
    });


    function addPair() {
      if (!selectedFirst.value || !selectedSecond.value) return;

      const first = selectedFirst.value;
      const second = selectedSecond.value;

      const exists = constructionPairs.value.some(p =>
        (p.first.id === first.id && p.second.id === second.id) ||
        (p.first.id === second.id && p.second.id === first.id)
      );

      if (!exists) {
        const newPair = { first, second } as ConstructionPair;
        constructionPairs.value.push(newPair);
        props.ch.addConstructionPair(newPair);
      }

      selectedFirst.value = null;
      selectedSecond.value = null;
    }

    function removePair(pair: ConstructionPair) {
      constructionPairs.value = constructionPairs.value.filter(p =>
        !(p.first.id === pair.first.id && p.second.id === pair.second.id)
      );
      props.ch.removeConstructionPair(pair);
    }

    const formatDistance = (value?: number): string =>
      value !== undefined ? value.toFixed(2) : '—';

    const formatObjectId = (model: DwgModel3d): string =>
      `[${model.$id ?? '—'}]:${model.$path}`;

    const intersectionAction = (item: InterceptData) => {
      const ch = props.ctx.createOutputChannel('intercept');
      props.ctx.cadview?.camera.zoom(item.interceptionBxo, props.ctx.cadview);
      ch.warn(`Количество точек пересечения: ${item.interception.length}`);
    };

    return {
      filterValue,
      filteredData,
      formatDistance,
      formatObjectId,
      intersectionAction,
            addPair,
      removePair,
      
      constructionTypes,
      selectedFirst,
      selectedSecond,
      constructionPairs,
      
      
    };
  }
});
</script>
