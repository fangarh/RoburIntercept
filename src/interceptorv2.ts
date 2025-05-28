import { DwgType } from "albatros/enums";

type MeshTriangle = { mesh: DwgMesh; triangleIndex: number };

export class IntersectionFinder2 {
    private context: Context;
    private editor: DwgEntityEditor;
    private drawing: Drawing;

    constructor(context: Context) {
        this.context = context;
        this.editor = context.cadview?.layer?.drawing?.layout.drawing?.layouts.model!.editor()!;
        this.drawing = context.cadview?.layer?.drawing?.layout.drawing!;
    }

    /**
     * Основной метод для поиска пересечения двух DwgEntity
     * @param entity1 Первая сущность
     * @param entity2 Вторая сущность
     * @returns Promise<DwgEntity> Новая сущность, представляющая пересечение
     */
    public async findIntersection(entity1: DwgModel3d, entity2: DwgModel3d): Promise<boolean> {

            return this.createIntersectionModel(entity1, entity2);

    }

    /**
     * Создает модель пересечения для двух DwgModel3d
     * @param model1 Первая 3D-модель
     * @param model2 Вторая 3D-модель
     * @returns Promise<DwgModel3d> Новая модель пересечения
     */
    private async createIntersectionModel(model1: DwgModel3d, model2: DwgModel3d): Promise<boolean> {
        // 1. Вычисляем мировые ограничивающие коробки и их пересечение
        
        const box1World: box3 = this.getWorldBoundingBox(model1);
        const box2World: box3 = this.getWorldBoundingBox(model2);

      /*  if(!Math3d.box3.containBox(box1World, box2World))
            return false;*/
        const intersectionBoxWorld: box3 | undefined = this.computeIntersectionBox(box1World, box2World);

        

        if (!intersectionBoxWorld) {
            //return this.createEmptyDwgModel3d();
            //console.log('>>' + Math3d.box3.containBox(box1World, box2World))
            return false;
        }
        
        // 2. Получаем кандидатные треугольники
        const candidateTriangles1: MeshTriangle[] = this.getCandidateTriangles(model1, intersectionBoxWorld);
        const candidateTriangles2: MeshTriangle[] = this.getCandidateTriangles(model2, intersectionBoxWorld);


        // 3. Вычисляем линии пересечения
        const intersectionLines: { a: vec3; b: vec3 }[] = await this.computeTriangleIntersections(
            model1,
            model2,
            candidateTriangles1,
            candidateTriangles2
        );

        if(intersectionLines.length == 0)
            return false;
        // 4. Создаем геометрию из линий пересечения
        const intersectionGeometry: Geometry3d = this.createGeometryFromIntersectionLines(intersectionLines);
       // await this.drawGeometryTrianglesAsPolylines(intersectionGeometry, 4);

        // 5. Создаем новую модель
        //const uuidGeometry: UuidGeometry3d = await Math3d.geometry.createUuidGeometry3d(intersectionGeometry);
        /*
        const newModel: DwgModel3d = await this.editor.addMesh({
            position: [0, 0, 0],
            rotation: 0,
            scale: [1, 1, 1],
            normal: [0, 0, 1],
        });
        this.editor.beginEdit();
        const geometry: DwgGeometry3d = await this.drawing.geometries.add(uuidGeometry);
        await newModel.addMesh({ geometry });
        this.editor.endEdit();
        */
        // Add annotation if there are intersection points
        //this.addAnnotation(intersectionLines, uuidGeometry, model1.layer?.getx("name") + "\n " + model2.layer?.getx("name") )

        return true;
    }

    private addAnnotation(intersectionLines: { a: vec3; b: vec3 }[], uuidGeometry: UuidGeometry3d, text: string){
        if (intersectionLines.length > 0 && uuidGeometry.bounds) {
            const box: box3 = uuidGeometry.bounds; // Minimal box containing all intersection points
            const center: vec3 = [0, 0, 0];
            Math3d.box3.center(center, box); // Compute the center of the box

            const annotation: AnnotationInit<AnnotationSimple> = {
                type: 'simple',
                position: center,
                text: text ,
                attachment: 'center', // Optional: aligns the label at the center
            };

            const layer = this.context.cadview?.annotations.standard!; // Use the standard annotation layer
            layer.add(annotation); // Add the annotation
            this.context.cadview?.invalidate(); // Refresh the view to display the annotation
            
        }
    }

    private async drawGeometryTrianglesAsLines(
        geometry: Geometry3d, 
        color: number = 0
    ): Promise<void> {
        const { vertices, indices } = geometry;
        this.editor.beginEdit();
        // Проверка корректности данных: количество индексов должно быть кратно 3
        if (indices.length % 3 !== 0) {
            console.error("Некорректное количество индексов в geometry.indices. Должно быть кратно 3.");
            return;
        }
    
        // Множество для хранения уникальных рёбер
        const edges = new Set<string>();
    
        // Проходим по всем треугольникам (каждый состоит из трёх индексов)
        for (let i = 0; i < indices.length; i += 3) {
            const idx0 = indices[i];
            const idx1 = indices[i + 1];
            const idx2 = indices[i + 2];
    
            // Формируем уникальные идентификаторы рёбер, сортируя индексы
            const edge1 = [idx0, idx1].sort().join(',');
            const edge2 = [idx1, idx2].sort().join(',');
            const edge3 = [idx2, idx0].sort().join(',');
    
            // Рисуем первое ребро, если оно ещё не добавлено
            if (!edges.has(edge1)) {
                edges.add(edge1);
                const a: vec3 = [vertices[idx0 * 3], vertices[idx0 * 3 + 1], vertices[idx0 * 3 + 2]];
                const b: vec3 = [vertices[idx1 * 3], vertices[idx1 * 3 + 1], vertices[idx1 * 3 + 2]];
                await this.editor.addLine({ color, a, b });
            }
    
            // Рисуем второе ребро, если оно ещё не добавлено
            if (!edges.has(edge2)) {
                edges.add(edge2);
                const a: vec3 = [vertices[idx1 * 3], vertices[idx1 * 3 + 1], vertices[idx1 * 3 + 2]];
                const b: vec3 = [vertices[idx2 * 3], vertices[idx2 * 3 + 1], vertices[idx2 * 3 + 2]];
                await this.editor.addLine({ color, a, b });
            }
    
            // Рисуем третье ребро, если оно ещё не добавлено
            if (!edges.has(edge3)) {
                edges.add(edge3);
                const a: vec3 = [vertices[idx2 * 3], vertices[idx2 * 3 + 1], vertices[idx2 * 3 + 2]];
                const b: vec3 = [vertices[idx0 * 3], vertices[idx0 * 3 + 1], vertices[idx0 * 3 + 2]];
                await this.editor.addLine({ color, a, b });
            }
        }

        this.editor.endEdit();
    }

    private async drawGeometryTrianglesAsPolylines( geometry: Geometry3d, color : number) {
        const { vertices, indices } = geometry;
    
        // Проверяем, что количество индексов кратно 3 (каждый треугольник — 3 вершины)
        
        if (indices.length % 3 !== 0) {
            console.error("Некорректное количество индексов в geometry.indices. Должно быть кратно 3.");
            return;
        }
    
        // Проходим по всем треугольникам
        for (let i = 0; i < indices.length; i += 3) {
            // Извлекаем индексы вершин текущего треугольника
            const idx0 = indices[i];
            const idx1 = indices[i + 1];
            const idx2 = indices[i + 2];
    
            // Получаем координаты вершин из массива vertices
            const v0: vec3 = [vertices[idx0 * 3], vertices[idx0 * 3 + 1], vertices[idx0 * 3 + 2]];
            const v1: vec3 = [vertices[idx1 * 3], vertices[idx1 * 3 + 1], vertices[idx1 * 3 + 2]];
            const v2: vec3 = [vertices[idx2 * 3], vertices[idx2 * 3 + 1], vertices[idx2 * 3 + 2]];
    
            // Создаем массив вершин для замкнутой полилинии: v0 -> v1 -> v2 -> v0
            const polylineVertices = [v0, v1, v2, v0];
    
    
            // Добавляем полилинию в редактор
            await this.drawTriangleAsPolyline(polylineVertices, color);
        }
    }

    private async drawTriangleAsPolyline(verticesWorld: vec3[],color : number ) {
        // Проверяем, что передано ровно 3 вершины для треугольника
        /*if (verticesWorld.length !== 3) {
            console.error("Некорректное количество вершин для треугольника. Требуется ровно 3, получено:", verticesWorld.length);
            return;
        }*/
        await this.editor.beginEdit();
        for(var i = 0; i < verticesWorld.length - 1; i ++){
            const line :  Partial<DwgLineData> = {
                color: color, 
                a:  verticesWorld [i],
                b:  verticesWorld [i+1],            
            };
            await this.editor.addLine(line);
        }
        // Формируем массив вершин для замкнутой полилинии: A, B, C, A
        const line :  Partial<DwgLineData> = {
            color: color, 
            a:  verticesWorld [verticesWorld.length],
            b:  verticesWorld [0]                
        };
        // Добавляем полилинию в редактор
        await this.editor.addPolyline(line);
        await this.editor.endEdit();
    }
    /**
     * Вычисляет мировую ограничивающую коробку для модели
     * @param model Модель
     * @returns box3 Ограничивающая коробка в мировых координатах
     */
    private getWorldBoundingBox(model: DwgModel3d): box3 {
        const box: box3 = Math3d.box3.alloc();
        let initialized: boolean = false;

        if(model.meshes == undefined){
            return [0, 0, 0, 0, 0, 0]; // Пустая коробка
        }

        for (const mesh of Object.values(model.meshes)) {
            const geometry: DwgGeometry3d | undefined = mesh.geometry;
            if (geometry) {
                const localBounds: box3 = geometry.bounds;
                const worldBounds: box3 = Math3d.box3.transformed(Math3d.box3.alloc(), localBounds, model.matrix);
                if (!initialized) {
                    Math3d.box3.dup(box, worldBounds);
                    initialized = true;
                } else {
                    Math3d.box3.addBox(box, worldBounds);
                }
            }
        }

        if (!initialized) {
            return [0, 0, 0, 0, 0, 0]; // Пустая коробка
        }
        return box;
    }

    /**
     * Вычисляет пересечение двух ограничивающих коробок
     * @param box1 Первая коробка
     * @param box2 Вторая коробка
     * @returns box3 | undefined Коробка пересечения или undefined, если пересечения нет
     */
    private computeIntersectionBox(box1: box3, box2: box3): box3 | undefined {
        const minX: number = Math.max(box1[0], box2[0]);
        const minY: number = Math.max(box1[1], box2[1]);
        const minZ: number = Math.max(box1[2], box2[2]);
        const maxX: number = Math.min(box1[3], box2[3]);
        const maxY: number = Math.min(box1[4], box2[4]);
        const maxZ: number = Math.min(box1[5], box2[5]);

        if (minX < maxX && minY < maxY && minZ < maxZ) {
            return [minX, minY, minZ, maxX, maxY, maxZ];
        }
        return undefined;
    }

    /**
     * Получает кандидатные треугольники, пересекающие заданную коробку
     * @param model Модель
     * @param intersectionBoxWorld Коробка пересечения в мировых координатах
     * @returns MeshTriangle[] Список кандидатных треугольников
     */
    private getCandidateTriangles(model: DwgModel3d, intersectionBoxWorld: box3): MeshTriangle[] {
        const modelMatrixInverse: mat4 = Math3d.mat4.inverse(Math3d.mat4.alloc(), model.matrix);
        const intersectionBoxLocal: box3 = Math3d.box3.transformed(Math3d.box3.alloc(), intersectionBoxWorld, modelMatrixInverse);
        const candidates: MeshTriangle[] = [];

        for (const mesh of Object.values(model.meshes)) {
            const geometry: DwgGeometry3d | undefined = mesh.geometry;
            if (geometry && geometry.spatial) {
                const triangleIndices: number[] = this.getTrianglesInBox(geometry.spatial, intersectionBoxLocal);
                for (const triangleIndex of triangleIndices) {
                    candidates.push({ mesh, triangleIndex });
                }
            }
        }
        return candidates;
    }

    /**
     * Извлекает индексы треугольников в заданной коробке с помощью SpatialIndex.walkBox
     * @param spatial Пространственный индекс
     * @param box Коробка в локальных координатах
     * @returns number[] Индексы треугольников
     */
    private getTrianglesInBox(spatial: SpatialIndex, box: box3): number[] {
        const triangles: number[] = [];
        spatial.walkBox(box, (triangleIndex: number) => {
            triangles.push(triangleIndex);
        });
        return triangles;
    }

    /**
     * Вычисляет линии пересечения между треугольниками двух моделей
     * @param model1 Первая модель
     * @param model2 Вторая модель
     * @param triangles1 Треугольники первой модели
     * @param triangles2 Треугольники второй модели
     * @returns Promise<{ a: vec3; b: vec3 }[]> Линии пересечения
     */
    private async computeTriangleIntersections(
        model1: DwgModel3d,
        model2: DwgModel3d,
        triangles1: MeshTriangle[],
        triangles2: MeshTriangle[]
    ): Promise<{ a: vec3; b: vec3 }[]> {
        const intersectionLines: { a: vec3; b: vec3 }[] = [];
        const model1Matrix: mat4 = model1.matrix;
        const model2Matrix: mat4 = model2.matrix;

        for (const t1 of triangles1) {
            const { mesh: mesh1, triangleIndex: idx1 } = t1;
            const geo1: DwgGeometry3d | undefined = mesh1.geometry;
            const vertices1Local: [vec3, vec3, vec3] = this.getTriangleVertices(geo1, idx1);
            const vertices1World: [vec3, vec3, vec3] = [
                Math3d.mat4.mulv3([0, 0, 0], model1Matrix, vertices1Local[0]),
                Math3d.mat4.mulv3([0, 0, 0], model1Matrix, vertices1Local[1]),
                Math3d.mat4.mulv3([0, 0, 0], model1Matrix, vertices1Local[2]),
            ];

            for (const t2 of triangles2) {
                const { mesh: mesh2, triangleIndex: idx2 } = t2;
                const geo2: DwgGeometry3d | undefined = mesh2.geometry;
                const vertices2Local: [vec3, vec3, vec3] = this.getTriangleVertices(geo2, idx2);
                const vertices2World: [vec3, vec3, vec3] = [
                    Math3d.mat4.mulv3([0, 0, 0], model2Matrix, vertices2Local[0]),
                    Math3d.mat4.mulv3([0, 0, 0], model2Matrix, vertices2Local[1]),
                    Math3d.mat4.mulv3([0, 0, 0], model2Matrix, vertices2Local[2]),
                ];

                const intersection: { a: vec3; b: vec3 } | null = this.intersectTriangles(vertices1World, vertices2World);
                if (intersection) {
                    intersectionLines.push(intersection);
                }
            }
        }
        return intersectionLines;
    }

    /**
     * Извлекает вершины треугольника из геометрии
     * @param geometry Геометрия
     * @param triangleIndex Индекс треугольника
     * @returns [vec3, vec3, vec3] Вершины треугольника
     */
    private getTriangleVertices(geometry: DwgGeometry3d | undefined, triangleIndex: number): [vec3, vec3, vec3] {
        if (!geometry || !geometry.indices || !geometry.vertices) {
            return [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
        }
    
        let indices: Uint32Array;
    
        // Проверяем тип indices и преобразуем при необходимости
        if (geometry.indices instanceof Uint32Array) {
            indices = geometry.indices; // Уже Uint32Array, используем напрямую
        } else if (geometry.indices instanceof Uint8Array || geometry.indices instanceof Uint16Array) {
            indices = new Uint32Array(geometry.indices); // Преобразуем в Uint32Array
        } else {
            throw new Error("Неподдерживаемый тип индексов");
        }
    
        const vertices: Float32Array = geometry.vertices;
    
        // Получаем индексы вершин треугольника
        const i0: number = indices[triangleIndex * 3];
        const i1: number = indices[triangleIndex * 3 + 1];
        const i2: number = indices[triangleIndex * 3 + 2];
    
        // Возвращаем координаты вершин треугольника
        return [
            [vertices[i0 * 3], vertices[i0 * 3 + 1], vertices[i0 * 3 + 2]],
            [vertices[i1 * 3], vertices[i1 * 3 + 1], vertices[i1 * 3 + 2]],
            [vertices[i2 * 3], vertices[i2 * 3 + 1], vertices[i2 * 3 + 2]],
        ];
    }

    /**
     * Вычисляет пересечение двух треугольников
     * @param t1 Первый треугольник
     * @param t2 Второй треугольник
     * @returns { a: vec3; b: vec3 } | null Линия пересечения или null
     */
    private intersectTriangles(t1: [vec3, vec3, vec3], t2: [vec3, vec3, vec3]): { a: vec3; b: vec3 } | null {
        const plane1: { normal: vec3; d: number } = this.getPlaneFromTriangle(t1);
        const plane2: { normal: vec3; d: number } = this.getPlaneFromTriangle(t2);

        const intersections1: vec3[] = this.getIntersections(t2, plane1, t1);
        const intersections2: vec3[] = this.getIntersections(t1, plane2, t2);
        const allIntersections: vec3[] = this.removeDuplicatePoints([...intersections1, ...intersections2]);

        if (allIntersections.length < 2) {
            return null;
        }

        const { pointA, pointB } = this.findFurthestPoints(allIntersections);
        if (pointA && pointB && this.isValidIntersection(pointA, pointB, t1, t2)) {
            return { a: pointA, b: pointB };
        }
        return null;
    }

    /**
     * Вычисляет плоскость по треугольнику
     * @param t Треугольник
     * @returns { normal: vec3; d: number } Параметры плоскости
     */
    private getPlaneFromTriangle(t: [vec3, vec3, vec3]): { normal: vec3; d: number } {
        const v1: vec3 = Math3d.vec3.sub([0, 0, 0], t[1], t[0]);
        const v2: vec3 = Math3d.vec3.sub([0, 0, 0], t[2], t[0]);
        const crossProduct: vec3 = [0, 0, 0];
        Math3d.vec3.cross(crossProduct, v1, v2);
        const normal: vec3 = [0, 0, 0];
        Math3d.vec3.normalize(normal, crossProduct);
        const d: number = -Math3d.vec3.dot(normal, t[0]);
        return { normal, d };
    }

    /**
     * Проверяет, находится ли точка внутри треугольника
     * @param p Точка
     * @param t Треугольник
     * @returns boolean Результат проверки
     */
    private isPointInsideTriangle(p: vec3, t: [vec3, vec3, vec3]): boolean {
        const [a, b, c] = t;
        const v0: vec3 = Math3d.vec3.sub([0, 0, 0], b, a);
        const v1: vec3 = Math3d.vec3.sub([0, 0, 0], c, a);
        const v2: vec3 = Math3d.vec3.sub([0, 0, 0], p, a);
        const dot00: number = Math3d.vec3.dot(v0, v0);
        const dot01: number = Math3d.vec3.dot(v0, v1);
        const dot02: number = Math3d.vec3.dot(v0, v2);
        const dot11: number = Math3d.vec3.dot(v1, v1);
        const dot12: number = Math3d.vec3.dot(v1, v2);
        const invDenom: number = 1 / (dot00 * dot11 - dot01 * dot01);
        const u: number = (dot11 * dot02 - dot01 * dot12) * invDenom;
        const v: number = (dot00 * dot12 - dot01 * dot02) * invDenom;
        return u >= 0 && v >= 0 && u + v <= 1;
    }

    /**
     * Находит точки пересечения треугольника с плоскостью
     * @param triangle Треугольник
     * @param plane Плоскость
     * @param otherTriangle Другой треугольник для проверки
     * @returns vec3[] Точки пересечения
     */
    private getIntersections(triangle: [vec3, vec3, vec3], plane: { normal: vec3; d: number }, otherTriangle: [vec3, vec3, vec3]): vec3[] {
        const intersections: vec3[] = [];
        for (let i = 0; i < 3; i++) {
            const a: vec3 = triangle[i];
            const b: vec3 = triangle[(i + 1) % 3];
            const da: number = Math3d.vec3.dot(plane.normal, a) + plane.d;
            const db: number = Math3d.vec3.dot(plane.normal, b) + plane.d;
            if (da * db < 0) {
                const t: number = da / (da - db);
                const point: vec3 = [0, 0, 0];
                const dir: vec3 = [0, 0, 0];
                Math3d.vec3.sub(dir, b, a);
                Math3d.vec3.mul(dir, dir, t);
                Math3d.vec3.add(point, a, dir);
                if (this.isPointInsideTriangle(point, otherTriangle)) {
                    intersections.push(point);
                }
            }
        }
        return intersections;
    }

    /**
     * Находит наиболее удаленные точки среди списка
     * @param points Список точек
     * @returns { pointA: vec3; pointB: vec3 } Две наиболее удаленные точки
     */
    private findFurthestPoints(points: vec3[]): { pointA: vec3; pointB: vec3 } {
        let maxDist: number = 0;
        let pointA: vec3 | null = null;
        let pointB: vec3 | null = null;
        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                const dist: number = Math3d.vec3.distance(points[i], points[j]);
                if (dist > maxDist) {
                    maxDist = dist;
                    pointA = points[i];
                    pointB = points[j];
                }
            }
        }
        return { pointA: pointA!, pointB: pointB! };
    }

    /**
     * Проверяет валидность линии пересечения
     * @param pointA Первая точка
     * @param pointB Вторая точка
     * @param t1 Первый треугольник
     * @param t2 Второй треугольник
     * @returns boolean Результат проверки
     */
    private isValidIntersection(pointA: vec3, pointB: vec3, t1: [vec3, vec3, vec3], t2: [vec3, vec3, vec3]): boolean {
        const midPoint: vec3 = [0, 0, 0];
        const dir: vec3 = [0, 0, 0];
        Math3d.vec3.sub(dir, pointB, pointA);
        Math3d.vec3.mul(dir, dir, 0.5);
        Math3d.vec3.add(midPoint, pointA, dir);
        return (
            this.isPointInsideTriangle(pointA, t1) && this.isPointInsideTriangle(pointB, t1) &&
            this.isPointInsideTriangle(pointA, t2) && this.isPointInsideTriangle(pointB, t2) &&
            this.isPointInsideTriangle(midPoint, t1) && this.isPointInsideTriangle(midPoint, t2)
        );
    }

    /**
     * Удаляет дублирующиеся точки
     * @param points Список точек
     * @returns vec3[] Уникальные точки
     */
    private removeDuplicatePoints(points: vec3[]): vec3[] {
      /*  const epsilon: number = 1e-6;
        return points.filter((p, i, arr) =>
            arr.findIndex(q => Math3d.vec3.distance(p, q) < epsilon) === i
        );*/
        return points;
    }

    /**
     * Создает геометрию из линий пересечения
     * @param lines Линии пересечения
     * @returns Geometry3d Новая геометрия
     */
    private createGeometryFromIntersectionLines(lines: { a: vec3; b: vec3 }[]): Geometry3d {
        const vertices: number[] = [];
        const indices: number[] = [];
        let vertexIndex: number = 0;

        for (const line of lines) {
            vertices.push(line.a[0], line.a[1], line.a[2], line.b[0], line.b[1], line.b[2]);
            indices.push(vertexIndex, vertexIndex + 1);
            vertexIndex += 2;
        }

        const geometry: Geometry3d = {
            vertices: new Float32Array(vertices),
            normals: new Float32Array(vertices.length),
            indices: new Uint32Array(indices),
        };
        Math3d.geometry.calculateNormals(geometry);
        return geometry;
    }

    /**
     * Создает пустую модель DwgModel3d
     * @returns Promise<DwgModel3d> Пустая модель
     */
    private async createEmptyDwgModel3d(): Promise<DwgModel3d> {
        await this.editor.beginEdit();
        const emptyGeometry: Geometry3d = {
            vertices: new Float32Array(),
            normals: new Float32Array(),
            indices: new Uint32Array(),
        };
        const uuidGeometry: UuidGeometry3d = await Math3d.geometry.createUuidGeometry3d(emptyGeometry);
        const newModel: DwgModel3d = await this.editor.addMesh({
            position: [0, 0, 0],
            rotation: 0,
            scale: [1, 1, 1],
            normal: [0, 0, 1],
        });
        const geometry: DwgGeometry3d = await this.drawing.geometries.add(uuidGeometry);
        await newModel.addMesh({ geometry });
        await this.editor.endEdit();
        return newModel;
    }
}