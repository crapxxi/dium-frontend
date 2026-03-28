import { Routes } from '@angular/router';
import { VenueListComponent } from './components/venue-list/venue-list.component';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { KitchenPanelComponent } from './components/kitchen-panel/kitchen-panel.component';
import { CartComponent } from './components/cart/cart.component';
import { VenueDetailComponent } from './components/venue-detail/venue-detail.component';
import { OrdersComponent } from './components/order/order.component';
import { ProfileComponent } from './components/profile/profile.component';
import { AdminRegisterOwnerComponent } from './components/admin/register-owner.component';
import { CreateVenueComponent } from './components/create-venue/create-venue.component';
import { ManageVenueComponent } from './components/manage-venue/manage-venue.component';
import { SupportComponent } from './components/support/support.component';

export const routes: Routes = [
  { path: '', redirectTo: 'venues', pathMatch: 'full' },
  { path: 'venues', component: VenueListComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'kitchen', component: KitchenPanelComponent },
  { path: 'cart', component: CartComponent },
  { path: 'venue/:id', component: VenueDetailComponent},
  { path: 'orders', component: OrdersComponent},
  { path: 'profile', component: ProfileComponent},
  { path: 'admin', component:AdminRegisterOwnerComponent},
  { path: 'create-venue', component:CreateVenueComponent},
  { path: 'manage-venue/:id', component:ManageVenueComponent},
  { path: 'support', component:SupportComponent},
  { path: '**', redirectTo: 'venues' }
];