const photos:Record<string,string>={
 Materials:'materials',
 'Contractor costs':'contractors',
 Other:'other',
};

export default function CategoryPhoto({category, className=''}:{category:string;className?:string}){
 return <span className={`category-photo ${className}`} data-photo={photos[category]??'other'} aria-hidden="true"/>;
}
