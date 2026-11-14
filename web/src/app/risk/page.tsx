import RiskScreen from '@/components/risk/RiskScreen';
import { exampleMode } from '@/lib/risk/loaders';
export default async function RiskPage({searchParams}:{searchParams:Promise<{risk?:string}>}) {
 const query=await searchParams;
 return <RiskScreen example={exampleMode(query.risk==='example'?'risk=example':'')}/>;
}
