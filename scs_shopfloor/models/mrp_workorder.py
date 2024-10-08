# See LICENSE file for full copyright and licensing details.

from odoo import _, models, fields,Command
from odoo.http import request
from odoo.exceptions import UserError

class MRPWorkOrder(models.Model):
    _inherit = "mrp.workorder"
    
    assigned_user_ids = fields.Many2many(comodel_name='res.users')
    partner_ids = fields.Many2many('res.partner')
    
    def get_duration_data(self):
        return self.sudo().get_duration()
    
    def end_all(self):
        self.partner_ids = [Command.clear()]
        return super().end_all()
    
    def button_pending(self):
        for part in self.partner_ids:
            self.stop_partner([part.id])
        super().button_pending()

    def stop_partner(self, partner_ids):
        user_ids = self.env['res.partner'].sudo().browse(partner_ids).mapped('user_ids')
        self.partner_ids = [Command.unlink(part) for part in partner_ids]
        self.env['mrp.workcenter.productivity'].search([
            ('user_id', 'in', user_ids.ids),
            ('workorder_id', 'in', self.ids),
            ('date_end', '=', False)
        ])._close()
        
    def button_start(self, bypass=False):
        skip_employee_check = bypass or (not request and not self.env.user.employee_id)
        main_employee = False
        if not skip_employee_check:
            if not self.env.context.get('mrp_display'):
                main_employee = self.env.user.employee_id.id
            else:
                connected_employees = self.env['hr.employee'].get_employees_connected()
                if len(connected_employees) == 0:
                    raise UserError(_("You need to log in to process this work order."))
                main_employee = self.env['hr.employee'].get_session_owner()
                if not main_employee:
                    raise UserError(_("There is no session chief. Please log in."))
                if any(main_employee not in [emp.id for emp in wo.allowed_employees] and not wo.all_employees_allowed for wo in self):
                    raise UserError(_("You are not allowed to work on the workorder"))

        res = super().button_start()
        for wo in self:
            if len(wo.time_ids) == 1 or all(wo.time_ids.mapped('date_end')):
                for check in wo.check_ids:
                    if check.component_id:
                        check._update_component_quantity()
            if main_employee:
                if len(wo.allowed_employees) == 0 or main_employee in [emp.id for emp in wo.allowed_employees]:
                    wo.start_employee(self.env['hr.employee'].browse(main_employee).id)
                    wo.employee_ids |= self.env['hr.employee'].browse(main_employee)
            else:
                time_data = self._prepare_timeline_vals(wo.duration, fields.Datetime.now())
                time_data['user_id'] = wo.env.user.id
                wo.partner_ids |= self.env.user.partner_id
                wo.env['mrp.workcenter.productivity'].create(time_data)
                wo.state = "progress"
        return res
    
    def _get_product_lots(self):
        lots_data = []
        all_lots = self.env['stock.lot'].search([('product_id', '=', self.product_id.id)])
        if all_lots:
            for rec in all_lots:
                lots_data.append({'id':rec.id,'name':rec.name})
        return lots_data
    
    def _get_available_product_to_scrap(self):
        self = self.sudo()
        lots_data = []
        all_prodcts = (self.production_id.move_raw_ids.filtered(lambda x: x.state not in ('done', 'cancel')) | self.production_id.move_finished_ids.filtered(lambda x: x.state == 'done')).mapped('product_id').ids
        all_lots = self.env['product.product'].search([('id', 'in', all_prodcts)])
        if all_lots:
            for rec in all_lots:
                lots_data.append({'id':rec.id,'name':rec.name})
        return lots_data
    
    def set_qty_producing_portal(self,selected_lot,scrap_qty=False):
        self = self.sudo()
        selected_lot = False if selected_lot == '' or selected_lot == None else int(selected_lot)
        if scrap_qty and self.product_id.product_tmpl_id.tracking == 'none':
            self.production_id.qty_producing = float(scrap_qty)
        self.production_id.lot_producing_id = selected_lot
        self.production_id.set_qty_producing()
    
class WorkCenter(models.Model):
    _inherit = "mrp.workcenter"
    
    allowed_user_ids = fields.Many2many('res.users',string="Allowed Users")
    
