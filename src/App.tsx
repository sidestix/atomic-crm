import { CRM } from "@/atomic-crm/root/CRM";

/**
 * Application entry point
 *
 * Customize Atomic CRM by passing props to the CRM component:
 *  - contactGender
 *  - companySectors
 *  - darkTheme
 *  - dealCategories
 *  - dealPipelineStatuses
 *  - dealStages
 *  - enableDeals - Set to false to disable deal functionality (default: true)
 *  - lightTheme
 *  - logo
 *  - noteStatuses
 *  - taskTypes
 *  - title
 * ... as well as all the props accepted by shadcn-admin-kit's <Admin> component.
 *
 * @example
 * // Basic usage
 * const App = () => (
 *    <CRM
 *       logo="./img/logo.png"
 *       title="Acme CRM"
 *    />
 * );
 *
 * @example
 * // Disable deals functionality
 * const App = () => (
 *    <CRM enableDeals={false} />
 * );
 */
const App = () => <CRM enableDeals={false} />;

export default App;
