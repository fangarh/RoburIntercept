<template>
  <div class="table-view">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>ID A</th>
          <th>ID B</th>
          <th>Тип</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(item, i) in data" :key="i">
          <td>{{ i + 1 }}</td>
          <td>{{ item.a?.$id || '-' }}</td>
          <td>{{ item.b?.$id || '-' }}</td>
          <td>{{ item.type || '-' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';

interface DwgObject {
  $id?: string;
}

interface InterceptData {
  a: DwgObject;
  b: DwgObject;
  type: string;
}

export default defineComponent({
  name: 'IntersectionsView',
  props: {
    data: {
      type: Array as PropType<InterceptData[]>,
      required: true,
    },
  },
});
</script>

<style scoped>
.table-view {
  padding: 10px;
  overflow: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  border: 1px solid #ccc;
  padding: 6px 10px;
  text-align: left;
}
</style>