import {declareType, TypedData, Types, withTypeOptions, snakeToCamelCaseConversion} from 'ydb-sdk';

export interface IOrder {
    customerId: number;
    orderId: number;
    description: string;
    orderDate: Date;
}

@withTypeOptions({namesConversion: snakeToCamelCaseConversion})
export class Order extends TypedData {
    @declareType(Types.UINT64)
    public customerId: number;

    @declareType(Types.UINT64)
    public orderId: number;

    @declareType(Types.DATE)
    public orderDate: Date;

    @declareType(Types.UTF8)
    public description: string;

    static create(customerId: number, orderId: number, description: string, orderDate: Date) {
        return new this({customerId, orderId, description, orderDate});
    }

    constructor(data: IOrder) {
        super(data);
        this.customerId = data.customerId;
        this.orderId = data.orderId;
        this.description = data.description;
        this.orderDate = data.orderDate;
    }
}

export function getOrdersData() {
    return Order.asTypedCollection([
            Order.create(1, 1, "Order 1", new Date("2006-02-03")),
            Order.create(1, 2, "Order 2", new Date("2007-08-24")),
            Order.create(1, 3, "Order 3", new Date("2008-11-21")),
            Order.create(1, 4, "Order 4", new Date("2010-06-25")),
            Order.create(2, 1, "Order 1", new Date("2014-04-06")),
            Order.create(2, 2, "Order 2", new Date("2015-04-12")),
            Order.create(2, 3, "Order 3", new Date("2016-04-24")),
            Order.create(2, 4, "Order 4", new Date("2017-04-23")),
            Order.create(2, 5, "Order 5", new Date("2018-03-25")),
            Order.create(3, 1, "Order 1", new Date("2019-04-23")),
            Order.create(3, 2, "Order 3", new Date("2020-03-25")),
    ]);
}
