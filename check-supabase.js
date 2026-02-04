const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://fkrijejmvtwwtgirlsey.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrcmlqZWptdnR3d3RnaXJsc2V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1OTgwMTAsImV4cCI6MjA4NTE3NDAxMH0.IOahwdGVSowVMn0FRpz_-EHU8bEv9areX6zY1rM-LdY'
);

async function checkUserSchema() {
    console.log('🔍 Verificando estrutura da tabela users...\n');

    // Buscar um usuário para ver todos os campos
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .limit(1);

    if (error) {
        console.error('❌ Erro:', error.message);
        return;
    }

    if (data && data.length > 0) {
        console.log('📋 Campos encontrados na tabela users:');
        const fields = Object.keys(data[0]);
        fields.forEach(f => console.log(`   - ${f}: ${typeof data[0][f]}`));

        // Verificar campos específicos
        console.log('\n🔍 Verificando campos críticos:');
        console.log('   customLogoUrl:', fields.includes('customLogoUrl') ? '✅ Existe' : '❌ NÃO EXISTE');
        console.log('   supportUrl:', fields.includes('supportUrl') ? '✅ Existe' : '❌ NÃO EXISTE');
        console.log('   password:', fields.includes('password') ? '✅ Existe' : '❌ NÃO EXISTE');

        if (!fields.includes('customLogoUrl')) {
            console.log('\n⚠️  A coluna customLogoUrl NÃO EXISTE na tabela!');
            console.log('   Você precisa adicionar no Supabase:');
            console.log('   ALTER TABLE users ADD COLUMN "customLogoUrl" TEXT;');
        }
        if (!fields.includes('supportUrl')) {
            console.log('\n⚠️  A coluna supportUrl NÃO EXISTE na tabela!');
            console.log('   Você precisa adicionar no Supabase:');
            console.log('   ALTER TABLE users ADD COLUMN "supportUrl" TEXT;');
        }
    } else {
        console.log('⚠️ Nenhum usuário encontrado.');
    }
}

checkUserSchema().catch(console.error);
