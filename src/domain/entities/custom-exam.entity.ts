export class CustomExamEntity {
  id: string;
  examinerId: string;
  title: string;
  description: string | null;
  instructions: string | null;
  durationMin: number;
  passingScore: number | null;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  isTimedOut(startedAt: Date): boolean {
    const elapsedMin = (Date.now() - startedAt.getTime()) / 1000 / 60;
    return elapsedMin >= this.durationMin;
  }
}
