export class Payment {
    constructor(
        public readonly id: string,
        public readonly amount: number,
        public readonly currency: string,
        public status: string,
        public readonly orderId: string,
        public readonly createdAt: Date,
        private _externalId?: string,
    ) { }

    public canBeCompleted(): boolean {
        return this.status === 'PENDING';
    }
    get externalId(): string | undefined {
        return this._externalId;
    }

    public setExternalId(id: string): void {
        if (this._externalId) {
            throw new Error("External ID is already set and cannot be changed");
        }
        this._externalId = id;
    }
}