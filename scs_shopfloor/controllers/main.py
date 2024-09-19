# See LICENSE file for full copyright and licensing details.

from odoo import http,_
from odoo.addons.portal.controllers.portal import pager as portal_pager
from odoo.addons.portal.controllers.portal import CustomerPortal
from odoo.http import request, content_disposition
import logging, base64
_logger = logging.getLogger(__name__)

class ShopFloorController(CustomerPortal):
    
    def _prepare_home_portal_values(self, counters):
        values = super()._prepare_home_portal_values(counters)

        if 'work_order_count' in counters:
            values['work_order_count'] = 1

        return values
    
    def _prepare_work_orders_domain(self, user_id):
        return [
            ('assigned_user_ids', 'in', user_id.id),
        ]
    
    def _prepare_work_order_portal_rendering_values(self,kwargs):
        WorkOrders = request.env['mrp.workorder'].sudo()

        sortby = 'date'

        user_id = request.env.user
        values = self._prepare_portal_layout_values()

        
        url = "/my/shopfloor"
        pager_values = portal_pager(
            url=url,
            total=WorkOrders.sudo().search_count([]),
            page=1,
            step=self._items_per_page,
            url_args={'sortby': sortby},
        )
        orders = WorkOrders.sudo().search([], limit=self._items_per_page, offset=pager_values['offset'])
        if orders:
            orders = orders.sudo().filtered(lambda ord:user_id.id in ord.assigned_user_ids.ids or user_id.id in ord.workcenter_id.allowed_user_ids.ids)
            
        values.update({
            'quotations': orders.sudo(),
            'orders': orders.sudo(),
            'pager': pager_values,
            'page_name': 'workorder',
            'default_url': url,
            'sortby': sortby,
        })

        return values
    
    

    
    @http.route(
        ["/my/shopfloor"],
        type="http",
        auth="public",
        website=True,
        csrf=False,
    )
    def shopfloor_portal_lines(self, **kwargs):
        values = self._prepare_work_order_portal_rendering_values(kwargs)
        return request.render("scs_shopfloor.portal_my_home_shopfloor_ext", values)
    
    @http.route(
        ["/work/order/<int:work_order_id>/<string:action>"],
        type="http",
        auth="public",
        website=True,
        csrf=False,
    )
    def shopfloor_order_action(self,work_order_id=False,action=False, **kwargs):
        if work_order_id and action:
            try:
                work_order = request.env['mrp.workorder'].sudo().browse(int(work_order_id))
                if work_order:
                    if action == 'start':
                        work_order.sudo().button_start(True)
                    if action == 'pause':
                        work_order.sudo().button_pending()
                    if action == 'done':
                        work_order.sudo().button_finish()
            except Exception as e:
                _logger.warning(e)
        return request.redirect("/my/shopfloor")
    
    
    @http.route(
        ["/my/shopfloor/worksheet/<int:work_order_id>"],
        type="http",
        auth="public",
        website=True,
        csrf=False,
    )
    def check_worksheet(self,work_order_id=False):
        if work_order_id:
            work_order = request.env['mrp.workorder'].sudo().browse(int(work_order_id))
            if work_order and work_order.worksheet:
                read_doc = base64.b64decode(work_order.worksheet)
                pdfhttpheaders = [
                    ("Content-Type", "application/pdf"),
                    ("Content-Length", u'%s' % len(read_doc)),
                ]
                res = request.make_response(read_doc, headers=pdfhttpheaders)
                return res
            return False
        return False
    
    @http.route(
        ["/product/scrap/<int:workorder_id>"],
        type="json",
        auth="public",
        website=True,
        csrf=False,
    )
    def scrap_products_portal(self,workorder_id=False,**kw):
        scrapOBJ = request.env['stock.scrap'].sudo()
        productionOBJ = request.env['mrp.production'].sudo()
        production_id = False
        if kw.get('production_id', False):
            production_id = productionOBJ.browse(int(kw['production_id']))
        data = {
            'workorder_id':workorder_id,
            'production_id':production_id.id,
            'company_id':production_id.company_id.id,
            'should_replenish': True if kw.get('should_replenish',False) else False,
            'scrap_qty':int(kw['scrap_qty']) if kw.get('scrap_qty',False) else False,
            'product_id': int(kw['product_id']) if kw.get('product_id',False) else False,
        }
        scrap = scrapOBJ.create(data)
        action = scrap.action_validate()
        print('\n\n\n\n\n\n====scrapOBJ=',action)
        return {'action':action, 'path':"/my/shopfloor"}
    
    @http.route(
        ["/product/scrap/done/<int:scrap_id>"],
        type="json",
        auth="public",
        website=True,
        csrf=False,
    )
    def confirm_scrap_products_portal(self,scrap_id=False):
        if scrap_id:      
            scrap = request.env['stock.scrap'].sudo().browse(int(scrap_id))
            if scrap:
                scrap.do_scrap()
                return True
        return False
            