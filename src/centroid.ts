
/** 
 * LineSegmentProcessor — класс/обёртка уровня приложения.
 * Ответственность: инкапсулировать сценарии, сохранять состояние, предоставлять методы высокого уровня.
  * @throws Ошибка валидации входных данных или несовместимый тип фигуры
 */

export class LineSegmentProcessor {
    private intersectionLines: { a: vec3; b: vec3 }[];

    constructor(intersectionLines: { a: vec3; b: vec3 }[]) {
        this.intersectionLines = intersectionLines;
    }

    public findCenterOrNearestPoint(): vec3 {
        if (this.intersectionLines.length === 0) {
            throw new Error("No lines provided");
        }

        const box: box3 = Math3d.box3.alloc();
        let firstPoint = true;
        this.intersectionLines.forEach(line => {
            if (firstPoint) {
                Math3d.box3.make(box, line.a, line.a);
                firstPoint = false;
            } else {
                Math3d.box3.addPoint(box, line.a);
            }
            Math3d.box3.addPoint(box, line.b);
        });

        const center: vec3 = Math3d.box3.center([0, 0, 0], box);

        for (const line of this.intersectionLines) {
            if (this.isPointOnLineSegment(center, line.a, line.b)) {
                return center; 
            }
        }

        let nearestPoint: vec3 = this.intersectionLines[0].a; 
        let minDistance = Math3d.vec3.distance(center, nearestPoint);

        this.intersectionLines.forEach(line => {
            const closest = this.closestPointOnLineSegment(center, line.a, line.b);
            const distance = Math3d.vec3.distance(center, closest);
            if (distance < minDistance) {
                minDistance = distance;
                nearestPoint = closest;
            }
        });

        return nearestPoint;
    }

    private isPointOnLineSegment(point: vec3, a: vec3, b: vec3): boolean {
        const ab = Math3d.vec3.sub([0, 0, 0], b, a);
        const ap = Math3d.vec3.sub([0, 0, 0], point, a); 
        const bp = Math3d.vec3.sub([0, 0, 0], point, b); 

        const crossProduct = Math3d.vec3.cross([0, 0, 0], ap, ab);
        const dotProduct = Math3d.vec3.dot(ap, ab); 

        return Math3d.vec3.len(crossProduct) < 1e-6 && dotProduct >= 0 && Math3d.vec3.dot(bp, ab) <= 0;
    }

    private closestPointOnLineSegment(point: vec3, a: vec3, b: vec3): vec3 {
        const ab = Math3d.vec3.sub([0, 0, 0], b, a); 
        const ap = Math3d.vec3.sub([0, 0, 0], point, a); 
        const proj = Math3d.vec3.dot(ap, ab) / Math3d.vec3.dot(ab, ab);

        if (proj <= 0) {
            return a; // Ближайшая точка — начало отрезка
        } else if (proj >= 1) {
            return b; // Ближайшая точка — конец отрезка
        } else {
            // Ближайшая точка внутри отрезка
            return Math3d.vec3.add([0, 0, 0], a, Math3d.vec3.mul([0, 0, 0], ab, proj));
        }
    }
}
