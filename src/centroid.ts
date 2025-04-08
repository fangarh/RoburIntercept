import { vec3, box3 } from 'your-vector-library'; // Предполагаемые типы для векторов и bounding box
import { Box3Lib, Vec3Lib } from 'your-math-library'; // Интерфейсы библиотек для работы с векторами и bounding box

class LineSegmentProcessor {
    /** Приватное поле для хранения массива отрезков */
    private intersectionLines: { a: vec3; b: vec3 }[];

    /**
     * Конструктор класса
     * @param intersectionLines Массив отрезков, где каждый отрезок задан начальной (a) и конечной (b) точками
     */
    constructor(intersectionLines: { a: vec3; b: vec3 }[]) {
        this.intersectionLines = intersectionLines;
    }

    /**
     * Находит центр bounding box или ближайшую к нему точку из массива отрезков
     * @returns Точка vec3 — либо центр bounding box, если он принадлежит фигуре, либо ближайшая точка на отрезках
     */
    public findCenterOrNearestPoint(): vec3 {
        if (this.intersectionLines.length === 0) {
            throw new Error("No lines provided");
        }

        // Шаг 1: Создание bounding box для всех точек отрезков
        const box: box3 = Box3Lib.alloc();
        let firstPoint = true;
        this.intersectionLines.forEach(line => {
            if (firstPoint) {
                // Инициализация bounding box первой точкой
                Box3Lib.make(box, line.a, line.a);
                firstPoint = false;
            } else {
                Box3Lib.addPoint(box, line.a);
            }
            Box3Lib.addPoint(box, line.b);
        });

        // Шаг 2: Вычисление центра bounding box
        const center: vec3 = Box3Lib.center(Vec3Lib.alloc(), box);

        // Шаг 3: Проверка, принадлежит ли центр какому-либо отрезку
        for (const line of this.intersectionLines) {
            if (this.isPointOnLineSegment(center, line.a, line.b)) {
                return center; // Центр лежит на отрезке, возвращаем его
            }
        }

        // Шаг 4: Поиск ближайшей точки на отрезках к центру
        let nearestPoint: vec3 = this.intersectionLines[0].a; // Начальная точка для сравнения
        let minDistance = Vec3Lib.distance(center, nearestPoint);

        this.intersectionLines.forEach(line => {
            const closest = this.closestPointOnLineSegment(center, line.a, line.b);
            const distance = Vec3Lib.distance(center, closest);
            if (distance < minDistance) {
                minDistance = distance;
                nearestPoint = closest;
            }
        });

        return nearestPoint;
    }

    /**
     * Проверяет, лежит ли точка на отрезке
     * @param point Точка для проверки
     * @param a Начало отрезка
     * @param b Конец отрезка
     * @returns true, если точка лежит на отрезке
     */
    private isPointOnLineSegment(point: vec3, a: vec3, b: vec3): boolean {
        const ab = Vec3Lib.sub(Vec3Lib.alloc(), b, a); // Вектор от a к b
        const ap = Vec3Lib.sub(Vec3Lib.alloc(), point, a); // Вектор от a к точке
        const bp = Vec3Lib.sub(Vec3Lib.alloc(), point, b); // Вектор от точки к b

        const crossProduct = Vec3Lib.cross(Vec3Lib.alloc(), ap, ab); // Векторное произведение
        const dotProduct = Vec3Lib.dot(ap, ab); // Скалярное произведение

        // Точка коллинеарна отрезку и лежит между a и b
        return Vec3Lib.len(crossProduct) < 1e-6 && dotProduct >= 0 && Vec3Lib.dot(bp, ab) <= 0;
    }

    /**
     * Находит ближайшую точку на отрезке к заданной точке
     * @param point Точка, к которой ищем ближайшую
     * @param a Начало отрезка
     * @param b Конец отрезка
     * @returns Ближайшая точка на отрезке
     */
    private closestPointOnLineSegment(point: vec3, a: vec3, b: vec3): vec3 {
        const ab = Vec3Lib.sub(Vec3Lib.alloc(), b, a); // Вектор от a к b
        const ap = Vec3Lib.sub(Vec3Lib.alloc(), point, a); // Вектор от a к точке

        // Вычисление проекции ap на ab
        const proj = Vec3Lib.dot(ap, ab) / Vec3Lib.dot(ab, ab);

        if (proj <= 0) {
            return a; // Ближайшая точка — начало отрезка
        } else if (proj >= 1) {
            return b; // Ближайшая точка — конец отрезка
        } else {
            // Ближайшая точка внутри отрезка
            return Vec3Lib.add(Vec3Lib.alloc(), a, Vec3Lib.mul(Vec3Lib.alloc(), ab, proj));
        }
    }
}

// Пример использования
const intersectionLines = [
    { a: { x: 0, y: 0, z: 0 }, b: { x: 1, y: 0, z: 0 } },
    { a: { x: 1, y: 0, z: 0 }, b: { x: 1, y: 1, z: 0 } }
];
const processor = new LineSegmentProcessor(intersectionLines);
const result = processor.findCenterOrNearestPoint();
console.log(result); // Ожидаемый вывод, например: { x: 0.5, y: 0.5, z: 0 }