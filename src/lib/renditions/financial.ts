export type RenditionBalanceInput={previousBalance:number;companyFunds:number;authorized:number;paid:number};
export type RenditionBalance={beforePayment:number;amountToPay:number;companyCredit:number;closingBalance:number};

export function calculateRenditionBalance(input:RenditionBalanceInput):RenditionBalance{
 const previousBalance=Number(input.previousBalance||0);
 const companyFunds=Math.max(0,Number(input.companyFunds||0));
 const authorized=Math.max(0,Number(input.authorized||0));
 const paid=Math.max(0,Number(input.paid||0));
 const beforePayment=previousBalance+authorized-companyFunds;
 const closingBalance=beforePayment-paid;
 return {beforePayment,amountToPay:Math.max(0,closingBalance),companyCredit:Math.max(0,-closingBalance),closingBalance};
}
