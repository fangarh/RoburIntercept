<template>
  <div class="intercept-table-view">
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
import { defineComponent, PropType, ref, computed } from 'vue';
import './style/InterceptTable.css'; // ✅ обновлённый путь к стилю

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
    data: {
      type: Array as PropType<InterceptData[]>,
      required: false
    },
    ctx: {
      type: Object as PropType<Context>,
      required: true
    }
  },
  setup(props) {
    const filterValue = ref<number>(5);

    const filteredData = computed(() => {
      if (!props.data || !Array.isArray(props.data)) return [];
      return props.data.filter(item =>
        item.length?.projectedDistance !== undefined &&
        item.length.projectedDistance >= filterValue.value
      );
    });

    const formatDistance = (value?: number): string =>
      value !== undefined ? value.toFixed(2) : '—';

    const formatObjectId = (model: DwgModel3d): string =>
      `[${model.$id ?? '—'}]:${model.$path}`;

    const intersectionAction = (item: InterceptData) => {
      const ch = props.ctx.createOutputChannel('intercept');
      ch.warn(`Количество точек пересечения: ${item.interception.length}`);
    };

    return {
      filterValue,
      filteredData,
      formatDistance,
      formatObjectId,
      intersectionAction
    };
  }
});
</script>
