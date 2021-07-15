const cds = require('@sap/cds')
const { Flights, Employees, Departments } = cds.entities

/** Service implementation for CatalogService */
module.exports = cds.service.impl( function() {
  this.before('CREATE', 'Flights', reduceDepartmentBudget)
  this.before('DELETE', 'Flights', increaseDepartmentBudget)
})

/** Reduce budget of employee department if available budget for the flight */
function reduceDepartmentBudget(req) {
  const {price : flightPrice, employee_eid: employeeID} = req.data
  return cds.transaction(req).run(
    UPDATE(Departments)
    .set('budget -=', flightPrice)
    .where('name in',
      SELECT('department_name')
      .from(Employees)
      .where('eid =', employeeID)
        )
    .and('budget >=', flightPrice)
  ).then( affectedRow => {
    if (affectedRow === 0)  req.error(409, 'Insufficient budget for this flight.')
  })
}

/** Increase budget of employee department */
async function increaseDepartmentBudget(req) {
  const {id : flightID} = req.data

  let priceResponse = await cds.run(
    SELECT('price').from(Flights).where('id =', flightID)
  )
  let employeeIDResponse = await cds.run(
    SELECT('employee_eid').from(Flights).where('id =', flightID)
  )
  
  if(priceResponse.length < 1 || employeeIDResponse.length < 1) {
    req.error(404, 'Flight not found.')
    return
  }

  const {price: flightPrice} = priceResponse[0]
  const {employee_eid: employeeID} = employeeIDResponse[0]

  return cds.transaction(req).run(
    UPDATE(Departments)
    .set('budget +=', flightPrice).where('name in',
    SELECT('department_name')
    .from(Employees).where('eid =', employeeID))
  )
}
